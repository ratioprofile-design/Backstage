#!/usr/bin/env python3

import os
import sys
import getopt

from DocxUnicodeConv import DocxUnicodeConv


def usage():
    print("")
    print("This tool invokes DocxUnicodeConv.py in batch mode based on")
    print("a file list passed as argument")
    print("")
    print("usage: python3 DocxUnicodeBatchConv.py -i <batch file> [ -f ]")
    print("")


def extract_batchfile(infile):
    with open(infile, "r", encoding="utf-8") as batchfile:
        flist = [line.strip() for line in batchfile.readlines() if line.strip()]
    return flist


def main():
    try:
        opts, args = getopt.getopt(sys.argv[1:], "i:fh", ["help", "input=", "force"])
    except getopt.GetoptError as err:
        print(str(err))
        usage()
        sys.exit(2)

    infile = None
    force_bamini = False
    for o, a in opts:
        if o in ("-i", "--input"):
            infile = a
        elif o in ("-f", "--force"):
            force_bamini = True
        elif o in ("-h", "--help"):
            usage()
            sys.exit(0)
        else:
            assert False, "unhandled option"

    if infile is None:
        print("")
        print("Error: Missing required argument '-i <batch file>'")
        print("")
        usage()
        sys.exit(2)

    flist = extract_batchfile(infile)
    for f in flist:
        if os.path.isfile(f):
            path = os.path.dirname(f)
            DocxUnicodeConv(f, path, force_bamini=force_bamini)
        else:
            print(f"Skipping non-existent file: {f}")


if __name__ == "__main__":
    main()
