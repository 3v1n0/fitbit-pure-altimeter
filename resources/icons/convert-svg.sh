#!/bin/bash
# Simple script to convert SVG icons to fitbit grayscale magic compatible PNGs
# Licensed under GPLv3

SIZE=${SIZE:-80}
icons_path=$(dirname "$0")

for svg in "$icons_path"/*.svg; do
    png="$icons_path/$(basename "$svg" .svg)".png
    tmp="$(mktemp ${TMPDIR:-/tmp}/tmp.XXXXXXXXX.png)"
    rsvg-convert "$svg" -w $SIZE -h $SIZE -f png -o "$png"
    convert "$png" -channel RGB -negate -colorspace gray -background black \
        -alpha remove -alpha off "$tmp"
    mv "$tmp" "$png"
    echo "$svg converted to $png"
done
