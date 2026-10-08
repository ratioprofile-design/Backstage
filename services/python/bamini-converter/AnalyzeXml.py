#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import getopt
import xml.etree.ElementTree as ET

from XmlExtract import extract_xml
from DocxUnicodeConv import convert_bamini


pending_tbi_vowel = None


def usage():
    print("")
    print("This tool extracts the xml file from a word document passed as argument")
    print("")
    print("usage: python3 AnalyzeXml.py -i <input file>")
    print("")


def ReplaceTextInXml(tb_obj):
    global pending_tbi_vowel
    tb_text = tb_obj.text
    if not tb_text:
        return
    print(tb_text)

    if tb_text == '¿':
        pending_tbi_vowel = tb_text
        tb_obj.text = ""
    elif pending_tbi_vowel is not None:
        tb_text = tb_text[:1] + pending_tbi_vowel + tb_text[1:]
        tb_obj.text = convert_bamini(tb_text)
        pending_tbi_vowel = None
    else:
        tb_obj.text = convert_bamini(tb_text)


def ParseAndReplaceTextInXml(filepath):
    xmlfile = extract_xml(filepath)
    tree = ET.parse(xmlfile)
    root = tree.getroot()
    if len(root) > 0:
        for i in range(len(root[0])):
            print(f"i = {i} tag: {root[0][i].tag}")
            for j in range(len(root[0][i])):
                print(f"j = {j} tag: {root[0][i][j].tag}")
                for k in range(len(root[0][i][j])):
                    print(f"k = {k} tag: {root[0][i][j][k].tag}")
                    for l in range(len(root[0][i][j][k])):
                        print(f"l = {l} tag: {root[0][i][j][k][l].tag}")
                        if root[0][i][j][k][l].tag.split('}')[-1] == 't':
                            ReplaceTextInXml(root[0][i][j][k][l])
    modxml = xmlfile + "-modified.xml"
    tree.write(modxml, xml_declaration=True, encoding="utf-8")
    return modxml


def main():
    try:
        opts, args = getopt.getopt(sys.argv[1:], "i:h", ["help", "input="])
    except getopt.GetoptError as err:
        print(str(err))
        usage()
        sys.exit(2)

    infile = None
    for o, a in opts:
        if o in ("-i", "--input"):
            infile = a
        elif o in ("-h", "--help"):
            usage()
            sys.exit(0)
        else:
            assert False, "unhandled option"

    if infile is None:
        print("")
        print("Error: Missing required argument '-i <input file>'")
        print("")
        usage()
        sys.exit(2)

    ParseAndReplaceTextInXml(infile)


if __name__ == "__main__":
    main()
