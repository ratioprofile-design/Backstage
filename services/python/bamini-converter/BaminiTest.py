#!/usr/bin/env python3

from BaminiDict import bamini_dict

text = "vd;W Ngrp mopAk;> Gfo;> nghUs;> NjLtjw;F my;y vd;W njsptu Gupe;Jnfhz;L> elf;f> ,iwNfl;L> mo Ntz;Lk;"
copy = text
for key in bamini_dict.keys():
    copy = copy.replace(str(key), str(bamini_dict.get(str(key))))

print("Original: " + text)
print("Modified: " + copy)

