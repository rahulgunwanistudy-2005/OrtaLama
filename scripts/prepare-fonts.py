"""Optional asset-authoring step; checked-in WOFF files need no runtime tooling.

Use an isolated environment with fonttools==4.67.0. WOFF uses standard zlib.
Preserve the adjacent OFL files and originals; no font glyph design is changed.
"""
from pathlib import Path
from fontTools import subset

for path in Path('apps/web/public/fonts').glob('*.ttf'):
    options=subset.Options()
    options.flavor='woff'
    font=subset.load_font(str(path),options)
    target=path.with_suffix('.woff')
    if path.stem=='IBMPlexMono-Regular':
        # IBM reserves "Plex" for the original font. Rename this subset's
        # internal family/full/PostScript names and filename under the OFL.
        names={1:'Ortalama Register Mono',2:'Regular',3:'OrtalamaRegisterMono-Regular-v1',4:'Ortalama Register Mono Regular',6:'OrtalamaRegisterMono-Regular',16:'Ortalama Register Mono',17:'Regular'}
        for record in font['name'].names:
            if record.nameID in names:record.string=names[record.nameID].encode(record.getEncoding())
        target=path.with_name('OrtalamaRegisterMono-Regular.woff')
    selection=subset.Subsetter(options=options)
    selection.populate(unicodes=list(range(0x20,0x250))+list(range(0x370,0x400))+list(range(0x2000,0x2300)))
    selection.subset(font)
    subset.save_font(font,str(target),options)
