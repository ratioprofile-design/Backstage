#!/usr/bin/env python3

import os
import sys
import getopt
import zipfile


# Functions....
def usage():
    print("")
    print("This tool extracts the xml file from a word document passed")
    print("as argument")
    print("")
    print("usage: ./XmlExtract.py -i <input file>")
    print("")


def create_newdoc(old_docfile, xmlfile, output_filename=None):
    if output_filename is None:
        output_filename = old_docfile + "-tb.docx"
    with zipfile.ZipFile(old_docfile, 'r') as doc:
        with zipfile.ZipFile(output_filename, 'w', compression=zipfile.ZIP_DEFLATED) as new:
            for item in doc.infolist():
                if item.filename != "word/document.xml":
                    new.writestr(item, doc.read(item.filename))
            new.write(xmlfile, "word/document.xml", compress_type=zipfile.ZIP_DEFLATED)
    return output_filename


def extract_xml(infile):
    outfile = infile + ".xml"
    with zipfile.ZipFile(infile, 'r') as doc:
        with open(outfile, "wb") as tempfile:
            tempfile.write(doc.read("word/document.xml"))
    return outfile


def main():
    try:
        opts, args = getopt.getopt(sys.argv[1:], "i:o:h", ["help", "input"])
    except getopt.GetoptError as err:
        print(str(err))
        usage()
        sys.exit(2)
    
    infile = outfile = None
    for o, a in opts:
        if o in ("-i", "--input"):
            infile = a
        elif o in ("-h", "--help"):
            usage()
            sys.exit()
        else:
            assert False, "unhandled option"
    
    if infile is None:
        print("")
        print("Error: Not all expected arguments are passed!!")
        print("")
        usage()
        sys.exit(2)

    extract_xml(infile)

if __name__ == "__main__": 
    main()

