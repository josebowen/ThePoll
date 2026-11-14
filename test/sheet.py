import sys, glob
from PIL import Image
tag, cols, tw = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
fs = sorted(glob.glob(f'test/out/{tag}-*.png'))
per = int(sys.argv[4]) if len(sys.argv) > 4 else len(fs)
for n in range(0, len(fs), per):
    part = fs[n:n+per]; ims = [Image.open(f).convert('RGB') for f in part]
    th = int(ims[0].height * tw / ims[0].width); rows = (len(ims) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * tw, rows * th), 'black')
    for i, im in enumerate(ims): sheet.paste(im.resize((tw, th)), ((i % cols) * tw, (i // cols) * th))
    sheet.save(f'test/out/sheet-{tag}-{n//per}.jpg', quality=82)
    print(f'test/out/sheet-{tag}-{n//per}.jpg', [f.split('/')[-1] for f in part])
