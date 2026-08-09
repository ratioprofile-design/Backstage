use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};

fn create_menu<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<Menu<R>> {
  let pkg_info = app.package_info();
  let about_metadata = tauri::menu::AboutMetadata {
    name: Some(pkg_info.name.clone()),
    version: Some(pkg_info.version.to_string()),
    ..Default::default()
  };

  // App Menu (macOS specific)
  let app_menu = Submenu::with_items(
    app,
    "Backstage",
    true,
    &[
      &PredefinedMenuItem::about(app, None, Some(about_metadata))?,
      &MenuItem::with_id(app, "check-for-updates", "Check for Updates...", true, None::<&str>)?,
      &PredefinedMenuItem::separator(app)?,
      &PredefinedMenuItem::hide(app, None)?,
      &PredefinedMenuItem::hide_others(app, None)?,
      &PredefinedMenuItem::show_all(app, None)?,
      &PredefinedMenuItem::separator(app)?,
      &PredefinedMenuItem::quit(app, None)?,
    ],
  )?;

  // File Menu
  let file_menu = Submenu::with_items(
    app,
    "File",
    true,
    &[
      &MenuItem::with_id(app, "new-project", "New Script...", true, Some("CmdOrCtrl+N"))?,
      &MenuItem::with_id(app, "open-file", "Open File...", true, Some("CmdOrCtrl+O"))?,
      &PredefinedMenuItem::separator(app)?,
      &MenuItem::with_id(app, "save-file", "Save", true, Some("CmdOrCtrl+S"))?,
      &MenuItem::with_id(app, "save-as-file", "Save As...", true, Some("CmdOrCtrl+Shift+S"))?,
      &PredefinedMenuItem::separator(app)?,
      &MenuItem::with_id(app, "print-file", "Print...", true, Some("CmdOrCtrl+P"))?,
      &PredefinedMenuItem::separator(app)?,
      &MenuItem::with_id(app, "close-project", "Close Project", true, Some("CmdOrCtrl+W"))?,
    ],
  )?;

  // Edit Menu
  let edit_menu = Submenu::with_items(
    app,
    "Edit",
    true,
    &[
      &PredefinedMenuItem::undo(app, None)?,
      &PredefinedMenuItem::redo(app, None)?,
      &PredefinedMenuItem::separator(app)?,
      &PredefinedMenuItem::cut(app, None)?,
      &PredefinedMenuItem::copy(app, None)?,
      &PredefinedMenuItem::paste(app, None)?,
      &PredefinedMenuItem::select_all(app, None)?,
    ],
  )?;

  // View Menu
  let theme_menu = Submenu::with_items(
    app,
    "Theme",
    true,
    &[
      &MenuItem::with_id(app, "theme-dark", "Dark", true, None::<&str>)?,
      &MenuItem::with_id(app, "theme-light", "Light", true, None::<&str>)?,
      &MenuItem::with_id(app, "theme-system", "System", true, None::<&str>)?,
    ],
  )?;

  let view_menu = Submenu::with_items(
    app,
    "View",
    true,
    &[
      &theme_menu,
      &PredefinedMenuItem::separator(app)?,
      &PredefinedMenuItem::fullscreen(app, None)?,
    ],
  )?;

  let menu = Menu::with_items(
    app,
    &[&app_menu, &file_menu, &edit_menu, &view_menu],
  )?;

  Ok(menu)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .menu(create_menu)
    .on_menu_event(|app, event| {
      use tauri::Emitter;
      let _ = app.emit("menu-click", event.id().as_ref());
    })
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
