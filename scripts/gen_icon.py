#!/usr/bin/env python3
"""Generate the dark-gold loli-studio icon. Run: python3 scripts/gen_icon.py"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "app/src/main/res")
SIZE = 1024

def background():
    image = Image.new("RGBA", (SIZE, SIZE))
    draw = ImageDraw.Draw(image)
    for y in range(SIZE):
        t = y / (SIZE - 1)
        color = (18 + int(28 * t), 17 + int(14 * t), 15, 255)
        draw.line([(0, y), (SIZE, y)], fill=color)
    return image

def main():
    image = background()
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((70, 70, 954, 954), radius=220, outline=(217, 178, 106, 255), width=28)
    draw.polygon([(512, 230), (760, 390), (690, 790), (334, 790), (264, 390)], outline=(236, 228, 211, 255), width=24)
    draw.arc((390, 470, 634, 700), 20, 160, fill=(217, 178, 106, 255), width=22)
    densities = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
    for name, size in densities.items():
        folder = os.path.join(OUT, "mipmap-" + name)
        os.makedirs(folder, exist_ok=True)
        icon = image.resize((size, size), Image.Resampling.LANCZOS)
        icon.save(os.path.join(folder, "ic_launcher.png"))
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
        round_icon = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        round_icon.paste(icon, (0, 0), mask)
        round_icon.save(os.path.join(folder, "ic_launcher_round.png"))
    print("图标已生成")

if __name__ == "__main__":
    main()
