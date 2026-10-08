# bamini-unicode-docx

A fast, accurate, and styling-preserving tool to convert legacy Tamil Word documents (`.docx`) to standard Tamil Unicode.

Supports **Bamini**, **Akaram**, **Ranjani**, **Aabohi**, **Amudham**, **Adhawin-Tamil**, and **Tamil Fancy** fonts.

---

## ✨ Features

- **Accurate Tamil Conversion:** Comprehensive mappings for vowels, consonants, Grantha letters (including Akaram's `~` / ஷ), ligatures, and pullis.
- **Strict Styling Preservation:** Maintains headings, tables, headers, footers, textboxes, alignments, colors, bold, and italic styles.
- **Optical Font Scaling (`-s` / `--scale`):** Unicode Tamil fonts have lower x-heights to accommodate stacked diacritics. Easily compensate with optical scaling (e.g. `+2pt`) to match the visual weight of legacy fonts.
- **Platform-Aware Defaults:** Automatically selects **Tamil Sangam MN** on macOS and **Latha** / **Nirmala UI** on Windows.
- **Multi-Run Merging:** Accurately reconstructs split words across runs without breaking styling boundaries.
- **Valid OpenXML Output:** Registers namespaces and uses `ZIP_DEFLATED` compression so files open natively in Microsoft Word, Pages, and LibreOffice without warnings.
- **Python 3 Native:** Tested and verified on modern Python 3 environments.

---

## 🚀 Installation & Requirements

- **Python 3.8+**
- **python-docx** library:
  ```bash
  pip install python-docx
  ```

---

## 📖 Usage

### Basic Conversion
```bash
python3 DocxUnicodeConv.py -i "YourDocument.docx"
```
Produces `YourDocument-modified.docx` in the same directory.

### Optical Scale Matching (Recommended for Legacy Scripts)
If your original document was typed in Akaram or Bamini and you want the Unicode text to have the exact same visual size and presence:
```bash
python3 DocxUnicodeConv.py -i "YourDocument.docx" -s 2
```

### Custom Output Path or Name
```bash
python3 DocxUnicodeConv.py -i "input.docx" -p "output.docx"
# Or output to a directory:
python3 DocxUnicodeConv.py -i "input.docx" -p "./output_folder/"
```

### Custom Font Selection
```bash
# macOS native font
python3 DocxUnicodeConv.py -i "input.docx" -t "Tamil Sangam MN"

# Windows standard Indic font
python3 DocxUnicodeConv.py -i "input.docx" -t "Nirmala UI"

# Latha
python3 DocxUnicodeConv.py -i "input.docx" -t "Latha"
```

### Force Conversion
If your document's font metadata is missing or unrecognized, force conversion across all runs:
```bash
python3 DocxUnicodeConv.py -i "input.docx" -f
```

### Batch Conversion
Convert multiple `.docx` files listed in a text file:
```bash
python3 DocxUnicodeBatchConv.py -i filelist.txt
```

---

## 🛠️ CLI Options

| Flag | Long Option | Description |
| :--- | :--- | :--- |
| `-i` | `--input` | Path to input `.docx` file *(required)* |
| `-p` | `--path` | Output destination file or directory *(optional)* |
| `-t` | `--target-font` | Target Unicode font name *(default: OS-native font)* |
| `-s` | `--scale` | Optical font size adjustment in points *(e.g. `2` or `2.5`)* |
| `-f` | `--force` | Force Bamini conversion even if font name is not recognized |
| `-h` | `--help` | Show command usage and options |

---

## 📄 License
MIT License
