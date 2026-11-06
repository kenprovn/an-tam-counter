"""Create simple app-owned geometric PWA icons. Requires Pillow, development only."""
from pathlib import Path
from PIL import Image, ImageDraw

directory = Path(__file__).resolve().parent.parent / 'public' / 'icons'
directory.mkdir(parents=True, exist_ok=True)
for size in (192, 512):
    scale = size / 192
    image = Image.new('RGB', (size, size), '#171321')
    draw = ImageDraw.Draw(image)
    box = tuple(round(n * scale) for n in (45, 45, 147, 147))
    draw.ellipse(box, outline='#bda5f5', width=round(5 * scale))
    draw.line([(round(x * scale), round(y * scale)) for x, y in [(70, 98), (88, 116), (123, 73)]], fill='#bda5f5', width=round(7 * scale), joint='curve')
    draw.ellipse(tuple(round(n * scale) for n in (129, 48, 147, 66)), fill='#e3d8fc')
    image.save(directory / f'icon-{size}.png', optimize=True)
