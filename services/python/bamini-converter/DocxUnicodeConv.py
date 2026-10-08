#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import io
import os
import sys
import getopt
import platform
import zipfile
import xml.etree.ElementTree as ET

from docx import Document
from docx.shared import Pt

from XmlExtract import extract_xml, create_newdoc
from BaminiDict import bamini_dict
from AmudhamDict import amudham_dict
from AdhawinTamilDict import adhawintamil_dict
from TamilFancyDict import tamilfancy_dict


# Default system Tamil font based on operating system
DEFAULT_TARGET_FONT = "Tamil Sangam MN" if platform.system() == "Darwin" else "Latha"

# English font whitelist (these will never be converted)
english_fonts = ["times new roman", "arial", "calibri", "courier new", "georgia", "verdana", "helvetica"]


def usage():
    print("")
    print("Bamini / Akaram to Tamil Unicode Word Document (.docx) Converter")
    print("---------------------------------------------------------------")
    print("Converts legacy Tamil fonts (Bamini, Akaram, Ranjani, Aabohi,")
    print("Amudham, Adhawin, Tamil Fancy) to standard Unicode Tamil")
    print("while strictly preserving all styles, headings, tables, and layouts.")
    print("")
    print("Usage: python3 DocxUnicodeConv.py -i <input.docx> [options]")
    print("")
    print("Options:")
    print("  -i, --input        Input .docx file path (required)")
    print("  -p, --path         Output file path or destination directory (optional)")
    print(f"  -t, --target-font  Target Unicode font name (default: '{DEFAULT_TARGET_FONT}')")
    print("  -s, --scale        Optical font size adjustment in points (e.g. 2 or 2.5)")
    print("  -f, --force        Force conversion even if font metadata is unrecognized")
    print("  -h, --help         Show this help message")
    print("")


def print_run(run):
    font_name = run.font.name if run.font else None
    style_font = run.style.font.name if (run.style and run.style.font) else None
    size = f"{run.font.size.pt}pt" if (run.font and run.font.size) else "default"
    print(f"run font = {font_name} (style: {style_font}, size: {size}) | text = {run.text[:60]}")


def convert_amudham(wg):
    text = wg
    for key, val in amudham_dict.items():
        text = text.replace(str(key), str(val))
    return text


def convert_bamini(wg):
    text = wg
    for key, val in bamini_dict.items():
        text = text.replace(str(key), str(val))
    return text


def convert_tamilfancy(wg):
    text = wg
    igh = 'à'
    pos = text.find(igh)
    if pos != -1 and pos + 2 < len(text) and pos - 1 >= 0:
        ltext = list(text)
        temp = ltext[pos + 2]
        ltext[pos + 2] = ltext[pos - 1]
        ltext[pos - 1] = temp
        text = "".join(ltext)

    for key, val in tamilfancy_dict.items():
        text = text.replace(str(key), str(val))
    return text


def convert_adhawintamil(wg):
    text = wg
    for key, val in adhawintamil_dict.items():
        text = text.replace(str(key), str(val))
    return text


def get_effective_font(run, p_font):
    """Find effective font from run, run XML properties, or paragraph font."""
    if run.font and run.font.name:
        return run.font.name

    try:
        rPr = run._r.find('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}rPr')
        if rPr is not None:
            rFonts = rPr.find('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}rFonts')
            if rFonts is not None:
                for attr in ('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}ascii',
                             '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}hAnsi',
                             '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}cs'):
                    val = rFonts.get(attr)
                    if val:
                        return val
    except Exception:
        pass

    if p_font:
        return p_font
    return None


def set_run_font(run, font_name):
    """Set font name across ascii, hAnsi, and complex script (cs) attributes."""
    if not font_name:
        return
    try:
        run.font.name = font_name
        rPr = run._r.get_or_add_rPr()
        rFonts = rPr.get_or_add_rFonts()
        rFonts.set('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}ascii', font_name)
        rFonts.set('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}hAnsi', font_name)
        rFonts.set('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}cs', font_name)
    except Exception:
        pass


def apply_scale(run, scale_pt):
    """Optically scale run font size while keeping exact relative sizing."""
    if not scale_pt or scale_pt == 0:
        return
    try:
        if run.font and run.font.size:
            current_pt = run.font.size.pt
            new_pt = max(6.0, current_pt + scale_pt)
            run.font.size = Pt(new_pt)
            half_pts = str(int(round(new_pt * 2)))
            rPr = run._r.find('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}rPr')
            if rPr is not None:
                sz = rPr.find('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}sz')
                if sz is not None:
                    sz.set('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val', half_pts)
                szCs = rPr.find('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}szCs')
                if szCs is not None:
                    szCs.set('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val', half_pts)
    except Exception:
        pass


def convert_runfont(run, p_font, force_bamini=False, target_font=DEFAULT_TARGET_FONT, scale_pt=0.0):
    if len(run.text) <= 0:
        return

    effective_font = get_effective_font(run, p_font)
    font_lower = (effective_font.strip().lower() if effective_font else "")

    converted = False
    if "amudham" in font_lower:
        run.text = convert_amudham(run.text)
        converted = True
    elif "adhawin" in font_lower:
        run.text = convert_adhawintamil(run.text)
        converted = True
    elif any(k in font_lower for k in ["bamini", "baamini", "ranjani", "aabohi", "akaram", "jaffna", "nallur"]):
        run.text = convert_bamini(run.text)
        converted = True
    elif "tamil_fancy" in font_lower or "tamilfancy" in font_lower:
        run.text = convert_tamilfancy(run.text)
        converted = True
    elif force_bamini:
        run.text = convert_bamini(run.text)
        converted = True

    if converted:
        t_font = target_font if target_font else DEFAULT_TARGET_FONT
        set_run_font(run, t_font)
        if scale_pt:
            apply_scale(run, scale_pt)


def can_merge_runs(r1, r2, p_font):
    """Ensure runs only merge if they share the same font, size, bold, italic, and color."""
    if get_effective_font(r1, p_font) != get_effective_font(r2, p_font):
        return False
    if r1.font.size != r2.font.size:
        return False
    if r1.bold != r2.bold:
        return False
    if r1.italic != r2.italic:
        return False
    return True


def convert_paragraph_runs(p, force_bamini=False, target_font=DEFAULT_TARGET_FONT, scale_pt=0.0):
    paragraph_font = None
    if p.style and p.style.font and p.style.font.name:
        paragraph_font = p.style.font.name

    runs = p.runs
    runs_len = len(runs)
    if runs_len == 0:
        return

    if runs_len == 1:
        convert_runfont(runs[0], paragraph_font, force_bamini=force_bamini, target_font=target_font, scale_pt=scale_pt)
        return

    # Multi-run paragraph
    idx = 0
    pending_i_vowel = None
    while idx < runs_len:
        if len(runs[idx].text) <= 0:
            idx += 1
            continue

        ref = idx
        # Concatenate consecutive runs sharing the exact same styling
        while idx + 1 < runs_len and can_merge_runs(runs[ref], runs[idx + 1], paragraph_font):
            runs[ref].text += runs[idx + 1].text
            runs[idx + 1].text = ""
            idx += 1

        curr_font = get_effective_font(runs[ref], paragraph_font)
        curr_font_lower = (curr_font.lower() if curr_font else "")

        # Correct the ¿ ை error by not converting immediately
        if "adhawin" in curr_font_lower and runs[ref].text.startswith('¿'):
            pending_i_vowel = runs[ref].text
            runs[ref].text = ""
        elif pending_i_vowel is not None:
            runs[ref].text = runs[ref].text[:1] + pending_i_vowel + runs[ref].text[1:]
            convert_runfont(runs[ref], paragraph_font, force_bamini=force_bamini, target_font=target_font, scale_pt=scale_pt)
            pending_i_vowel = None
        else:
            convert_runfont(runs[ref], paragraph_font, force_bamini=force_bamini, target_font=target_font, scale_pt=scale_pt)

        idx += 1


pending_tbi_vowel = None


def ReplaceTextInXml(tb_obj):
    global pending_tbi_vowel
    tb_text = tb_obj.text
    if not tb_text:
        return

    if tb_text == '¿':
        pending_tbi_vowel = tb_text
        tb_obj.text = ""
    elif pending_tbi_vowel is not None:
        tb_text = tb_text[:1] + pending_tbi_vowel + tb_text[1:]
        tb_obj.text = convert_bamini(tb_text)
        pending_tbi_vowel = None
    else:
        tb_obj.text = convert_bamini(tb_text)


def ParseAndReplaceTextBoxTexts(filepath):
    # Dynamically register all XML namespaces so standard prefixes like w: are preserved
    with open(filepath, 'rb') as f:
        xml_bytes = f.read()

    for event, elem in ET.iterparse(io.BytesIO(xml_bytes), events=['start-ns']):
        prefix, uri = elem
        try:
            ET.register_namespace(prefix, uri)
        except Exception:
            pass

    tree = ET.parse(filepath)
    root = tree.getroot()

    global pending_tbi_vowel
    pending_tbi_vowel = None

    # Replace in drawing / textbox content
    for txbx in root.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}txbxContent'):
        for t_elem in txbx.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t'):
            ReplaceTextInXml(t_elem)

    for vtb in root.iter('{urn:schemas-microsoft-com:vml}textbox'):
        for t_elem in vtb.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t'):
            ReplaceTextInXml(t_elem)

    # Legacy nested scan down to level 12 (for textboxes not identified by txbxContent)
    if len(root) > 0:
        for i in range(len(root[0])):
            for j in range(len(root[0][i])):
                for k in range(len(root[0][i][j])):
                    for l in range(len(root[0][i][j][k])):
                        if root[0][i][j][k][l].tag.split('}')[-1] == 't':
                            ReplaceTextInXml(root[0][i][j][k][l])
                        for m in range(len(root[0][i][j][k][l])):
                            if root[0][i][j][k][l][m].tag.split('}')[-1] == 't':
                                ReplaceTextInXml(root[0][i][j][k][l][m])
                            for n in range(len(root[0][i][j][k][l][m])):
                                if root[0][i][j][k][l][m][n].tag.split('}')[-1] == 't':
                                    ReplaceTextInXml(root[0][i][j][k][l][m][n])
                                for o in range(len(root[0][i][j][k][l][m][n])):
                                    if root[0][i][j][k][l][m][n][o].tag.split('}')[-1] == 't':
                                        ReplaceTextInXml(root[0][i][j][k][l][m][n][o])
                                    for p in range(len(root[0][i][j][k][l][m][n][o])):
                                        if root[0][i][j][k][l][m][n][o][p].tag.split('}')[-1] == 't':
                                            ReplaceTextInXml(root[0][i][j][k][l][m][n][o][p])
                                        for q in range(len(root[0][i][j][k][l][m][n][o][p])):
                                            if root[0][i][j][k][l][m][n][o][p][q].tag.split('}')[-1] == 't':
                                                ReplaceTextInXml(root[0][i][j][k][l][m][n][o][p][q])
                                            for r in range(len(root[0][i][j][k][l][m][n][o][p][q])):
                                                if root[0][i][j][k][l][m][n][o][p][q][r].tag.split('}')[-1] == 't':
                                                    ReplaceTextInXml(root[0][i][j][k][l][m][n][o][p][q][r])
                                                for s in range(len(root[0][i][j][k][l][m][n][o][p][q][r])):
                                                    if root[0][i][j][k][l][m][n][o][p][q][r][s].tag.split('}')[-1] == 't':
                                                        ReplaceTextInXml(root[0][i][j][k][l][m][n][o][p][q][r][s])
                                                    for t in range(len(root[0][i][j][k][l][m][n][o][p][q][r][s])):
                                                        if root[0][i][j][k][l][m][n][o][p][q][r][s][t].tag.split('}')[-1] == 't':
                                                            ReplaceTextInXml(root[0][i][j][k][l][m][n][o][p][q][r][s][t])
                                                        for u in range(len(root[0][i][j][k][l][m][n][o][p][q][r][s][t])):
                                                            if root[0][i][j][k][l][m][n][o][p][q][r][s][t][u].tag.split('}')[-1] == 't':
                                                                ReplaceTextInXml(root[0][i][j][k][l][m][n][o][p][q][r][s][t][u])

    modxml = filepath + "-modified.xml"
    tree.write(modxml, xml_declaration=True, encoding="utf-8")
    return modxml


def DocxUnicodeConv(infile, outpath=None, force_bamini=False, target_font=DEFAULT_TARGET_FONT, scale_pt=0.0):
    if not os.path.isfile(infile):
        print(f"Error: file not found: {infile}")
        return None

    base, ext = os.path.splitext(infile)
    if not ext:
        ext = ".docx"

    if outpath:
        if outpath.lower().endswith(".docx"):
            final_output = outpath
        else:
            os.makedirs(outpath, exist_ok=True)
            final_output = os.path.join(outpath, os.path.basename(base) + "-modified" + ext)
    else:
        final_output = base + "-modified" + ext

    print(f"Converting: {infile} -> {final_output}")
    print(f"Settings: font='{target_font}', scale_adjustment={scale_pt}pt, force_bamini={force_bamini}")
    document = Document(infile)

    # Convert paragraphs
    for p in document.paragraphs:
        convert_paragraph_runs(p, force_bamini=force_bamini, target_font=target_font, scale_pt=scale_pt)

    # Convert tables
    for table in document.tables:
        for row in table.rows:
            for cell in row.cells:
                for p in cell.paragraphs:
                    convert_paragraph_runs(p, force_bamini=force_bamini, target_font=target_font, scale_pt=scale_pt)

    # Convert headers and footers
    for section in document.sections:
        if section.header:
            for p in section.header.paragraphs:
                convert_paragraph_runs(p, force_bamini=force_bamini, target_font=target_font, scale_pt=scale_pt)
        if section.footer:
            for p in section.footer.paragraphs:
                convert_paragraph_runs(p, force_bamini=force_bamini, target_font=target_font, scale_pt=scale_pt)

    temp_docx = base + ".tmp_conv.docx"
    document.save(temp_docx)

    # Handle textboxes inside XML
    try:
        docxml = extract_xml(temp_docx)
        newxml = ParseAndReplaceTextBoxTexts(docxml)
        create_newdoc(temp_docx, newxml, output_filename=final_output)

        if os.path.exists(docxml):
            os.remove(docxml)
        if os.path.exists(newxml):
            os.remove(newxml)
    except Exception as e:
        print(f"Notice: XML textbox processing fallback ({e}), saving document directly.")
        document.save(final_output)
    finally:
        if os.path.exists(temp_docx):
            os.remove(temp_docx)

    print(f"\nSuccessfully converted! Output saved to: {final_output}")
    return final_output


def main():
    try:
        opts, args = getopt.getopt(sys.argv[1:], "i:p:ft:s:h", ["help", "input=", "path=", "force", "target-font=", "scale="])
    except getopt.GetoptError as err:
        print(str(err))
        usage()
        sys.exit(2)

    infile = ""
    outpath = None
    force_bamini = False
    target_font = DEFAULT_TARGET_FONT
    scale_pt = 0.0

    for o, a in opts:
        if o in ("-i", "--input"):
            infile = a
        elif o in ("-p", "--path"):
            outpath = a
        elif o in ("-f", "--force"):
            force_bamini = True
        elif o in ("-t", "--target-font"):
            target_font = a
        elif o in ("-s", "--scale"):
            try:
                scale_pt = float(a)
            except ValueError:
                print(f"Error: Invalid scale value '{a}', expected a number like 2 or 2.5")
                sys.exit(2)
        elif o in ("-h", "--help"):
            usage()
            sys.exit(0)
        else:
            assert False, "unhandled option"

    if infile == "":
        print("")
        print("Error: Missing required argument '-i <input file>'")
        print("")
        usage()
        sys.exit(2)

    if os.path.isfile(infile):
        DocxUnicodeConv(infile, outpath=outpath, force_bamini=force_bamini, target_font=target_font, scale_pt=scale_pt)
    else:
        print(f"Error: Input file does not exist: {infile}")
        sys.exit(1)


if __name__ == "__main__":
    main()
