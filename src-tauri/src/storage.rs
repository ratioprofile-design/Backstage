use std::fs;
use std::path::PathBuf;
use std::time::SystemTime;
use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
pub struct LocalProjectMeta {
    pub id: String,
    pub file_path: String,
    pub file_size_bytes: u64,
    pub updated_at: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StorageStats {
    pub projects_dir: String,
    pub total_projects: usize,
    pub total_size_bytes: u64,
}

fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect()
}

pub fn get_projects_dir<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    // Save to user documents directory: ~/Documents/Backstage/Projects
    let base_dir = app.path().document_dir()
        .map_err(|e| format!("Failed to get document directory: {}", e))?;
    
    let projects_dir = base_dir.join("Backstage").join("Projects");
    if !projects_dir.exists() {
        fs::create_dir_all(&projects_dir)
            .map_err(|e| format!("Failed to create projects directory: {}", e))?;
    }
    Ok(projects_dir)
}

#[tauri::command]
pub fn save_project_local<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    project_id: String,
    data: String,
) -> Result<LocalProjectMeta, String> {
    let projects_dir = get_projects_dir(&app)?;
    let safe_id = sanitize_filename(&project_id);
    let target_file = projects_dir.join(format!("{}.backstage", safe_id));
    let temp_file = projects_dir.join(format!("{}.backstage.tmp", safe_id));

    // Atomic write: write to .tmp then rename to prevent corruption on crash
    fs::write(&temp_file, &data)
        .map_err(|e| format!("Failed to write temporary project file: {}", e))?;
    
    fs::rename(&temp_file, &target_file)
        .map_err(|e| format!("Failed to finalize project file: {}", e))?;

    let metadata = fs::metadata(&target_file)
        .map_err(|e| format!("Failed to get file metadata: {}", e))?;

    let updated_at = metadata.modified()
        .unwrap_or(SystemTime::now())
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    log::info!("[RustStorage] Saved project '{}' ({} bytes) to {:?}", project_id, metadata.len(), target_file);

    Ok(LocalProjectMeta {
        id: project_id,
        file_path: target_file.to_string_lossy().to_string(),
        file_size_bytes: metadata.len(),
        updated_at,
    })
}

#[tauri::command]
pub fn load_project_local<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    project_id: String,
) -> Result<String, String> {
    let projects_dir = get_projects_dir(&app)?;
    let safe_id = sanitize_filename(&project_id);
    let target_file = projects_dir.join(format!("{}.backstage", safe_id));

    if !target_file.exists() {
        return Err(format!("Project file not found: {:?}", target_file));
    }

    let content = fs::read_to_string(&target_file)
        .map_err(|e| format!("Failed to read project file: {}", e))?;

    log::info!("[RustStorage] Loaded project '{}' from {:?}", project_id, target_file);
    Ok(content)
}

#[tauri::command]
pub fn list_local_projects<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
) -> Result<Vec<LocalProjectMeta>, String> {
    let projects_dir = get_projects_dir(&app)?;
    let mut projects = Vec::new();

    if let Ok(entries) = fs::read_dir(&projects_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("backstage") {
                if let Some(file_stem) = path.file_stem().and_then(|s| s.to_str()) {
                    if let Ok(meta) = entry.metadata() {
                        let updated_at = meta.modified()
                            .unwrap_or(SystemTime::now())
                            .duration_since(SystemTime::UNIX_EPOCH)
                            .map(|d| d.as_secs())
                            .unwrap_or(0);

                        projects.push(LocalProjectMeta {
                            id: file_stem.to_string(),
                            file_path: path.to_string_lossy().to_string(),
                            file_size_bytes: meta.len(),
                            updated_at,
                        });
                    }
                }
            }
        }
    }

    // Sort newest first
    projects.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(projects)
}

#[tauri::command]
pub fn delete_project_local<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    project_id: String,
) -> Result<bool, String> {
    let projects_dir = get_projects_dir(&app)?;
    let safe_id = sanitize_filename(&project_id);
    let target_file = projects_dir.join(format!("{}.backstage", safe_id));

    if target_file.exists() {
        fs::remove_file(&target_file)
            .map_err(|e| format!("Failed to delete project file: {}", e))?;
        log::info!("[RustStorage] Deleted project '{}'", project_id);
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub fn get_storage_stats<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
) -> Result<StorageStats, String> {
    let projects_dir = get_projects_dir(&app)?;
    let mut total_size = 0u64;
    let mut count = 0usize;

    if let Ok(entries) = fs::read_dir(&projects_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("backstage") {
                if let Ok(meta) = entry.metadata() {
                    total_size += meta.len();
                    count += 1;
                }
            }
        }
    }

    Ok(StorageStats {
        projects_dir: projects_dir.to_string_lossy().to_string(),
        total_projects: count,
        total_size_bytes: total_size,
    })
}

#[tauri::command]
pub fn save_documents_local<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    project_id: String,
    docs_json: String,
) -> Result<LocalProjectMeta, String> {
    let projects_dir = get_projects_dir(&app)?;
    let safe_id = sanitize_filename(&project_id);
    let target_file = projects_dir.join(format!("{}.docs.json", safe_id));
    let temp_file = projects_dir.join(format!("{}.docs.json.tmp", safe_id));

    fs::write(&temp_file, &docs_json)
        .map_err(|e| format!("Failed to write temporary documents file: {}", e))?;
    
    fs::rename(&temp_file, &target_file)
        .map_err(|e| format!("Failed to finalize documents file: {}", e))?;

    let metadata = fs::metadata(&target_file)
        .map_err(|e| format!("Failed to get documents metadata: {}", e))?;

    let updated_at = metadata.modified()
        .unwrap_or(SystemTime::now())
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    log::info!("[RustStorage] Saved documents for project '{}' ({} bytes)", project_id, metadata.len());

    Ok(LocalProjectMeta {
        id: format!("{}_docs", project_id),
        file_path: target_file.to_string_lossy().to_string(),
        file_size_bytes: metadata.len(),
        updated_at,
    })
}

#[tauri::command]
pub fn load_documents_local<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    project_id: String,
) -> Result<String, String> {
    let projects_dir = get_projects_dir(&app)?;
    let safe_id = sanitize_filename(&project_id);
    let target_file = projects_dir.join(format!("{}.docs.json", safe_id));

    if !target_file.exists() {
        return Ok("[]".to_string());
    }

    let content = fs::read_to_string(&target_file)
        .map_err(|e| format!("Failed to read documents file: {}", e))?;

    Ok(content)
}
