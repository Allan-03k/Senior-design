"""
Cooking guide routes - generate AI tutorial videos and detailed steps
"""
import os
import logging
import json
import time
from pathlib import Path
import subprocess
from anthropic import Anthropic
from flask import send_from_directory, request, Blueprint

cooking_guide_bp = Blueprint('cooking_guide', __name__)

logger = logging.getLogger(__name__)


def normalize_ingredient(ingredient):
    """Normalize ingredient name"""
    import re
    normalized = re.sub(
        r'\d+\s*(cup|tbsp|tsp|oz|g|kg|ml|l|pound|liter)',
        '',
        ingredient,
        flags=re.IGNORECASE
    )
    normalized = re.sub(
        r'(diced|chopped|sliced|minced|ground|fresh|dried|cooked)',
        '',
        normalized,
        flags=re.IGNORECASE
    )
    normalized = normalized.strip().lower()
    return normalized


def optimize_cooking_steps(recipe_name, ingredients, steps):
    """Use Claude to optimize cooking steps"""
    client = Anthropic()

    ingredients_str = ', '.join(ingredients[:10]) if ingredients else "not specified"
    steps_str = '; '.join(steps[:3]) if steps else "no steps provided"

    prompt = f"""
    Recipe name: {recipe_name}
    Ingredients: {ingredients_str}
    Original steps: {steps_str}

    Please generate detailed, easy-to-follow cooking steps. Return valid JSON (no markdown code blocks):
    {{
        "steps": [
            {{
                "step_num": 1,
                "title": "Step title",
                "description": "Detailed description",
                "duration_minutes": 5,
                "tips": "Key tip",
                "tools": ["tool1", "tool2"]
            }}
        ],
        "total_time_minutes": 30,
        "difficulty": "easy"
    }}

    difficulty must be one of: easy, medium, hard
    Please generate 4-6 detailed steps.
    """

    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}]
        )

        content = response.content[0].text

        if '```json' in content:
            content = content.split('```json')[1].split('```')[0]
        elif '```' in content:
            content = content.split('```')[1].split('```')[0]

        result = json.loads(content.strip())
        return result

    except Exception as e:
        logger.error(f"Claude API call failed: {str(e)}")
        return {
            "steps": [
                {
                    "step_num": 1,
                    "title": "Prepare Ingredients",
                    "description": "Gather and prepare all required ingredients and seasonings",
                    "duration_minutes": 10,
                    "tips": "Make sure all ingredients are weighed or measured",
                    "tools": ["cutting board", "knife"]
                },
                {
                    "step_num": 2,
                    "title": "Cook",
                    "description": "Cook using the traditional method",
                    "duration_minutes": 20,
                    "tips": "Keep medium heat and stir regularly",
                    "tools": ["pot", "spatula"]
                },
                {
                    "step_num": 3,
                    "title": "Plate and Serve",
                    "description": "Plate the dish and serve",
                    "duration_minutes": 5,
                    "tips": "Keep warm and plate nicely",
                    "tools": ["plate"]
                }
            ],
            "total_time_minutes": 35,
            "difficulty": "easy"
        }


def _load_font(path, size):
    from PIL import ImageFont
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


def _wrap_text(text, font, draw, max_width):
    import textwrap
    # Estimate chars per line based on average char width
    try:
        avg_w = font.getlength("x")
        chars_per_line = max(20, int(max_width / avg_w))
    except Exception:
        chars_per_line = 60
    return textwrap.wrap(text, width=chars_per_line)


def _draw_rounded_rect(draw, xy, radius, fill):
    x0, y0, x1, y1 = xy
    draw.rectangle([x0 + radius, y0, x1 - radius, y1], fill=fill)
    draw.rectangle([x0, y0 + radius, x1, y1 - radius], fill=fill)
    draw.ellipse([x0, y0, x0 + 2*radius, y0 + 2*radius], fill=fill)
    draw.ellipse([x1 - 2*radius, y0, x1, y0 + 2*radius], fill=fill)
    draw.ellipse([x0, y1 - 2*radius, x0 + 2*radius, y1], fill=fill)
    draw.ellipse([x1 - 2*radius, y1 - 2*radius, x1, y1], fill=fill)


def create_video_from_steps(recipe_name, steps, output_path):
    """Render each cooking step as a slide image and combine into an MP4."""
    try:
        from PIL import Image, ImageDraw
        import shutil, textwrap, tempfile

        FONT_PATH = "/System/Library/Fonts/Helvetica.ttc"
        W, H = 1280, 720
        PAD = 60
        ACCENT = (255, 107, 53)       # orange
        BG = (245, 245, 242)          # off-white
        CARD_BG = (255, 255, 255)
        DARK = (30, 30, 30)
        MUTED = (110, 110, 110)
        TIP_BG = (255, 248, 230)
        TIP_BORDER = (255, 193, 7)

        font_step_label = _load_font(FONT_PATH, 22)
        font_title      = _load_font(FONT_PATH, 42)
        font_body       = _load_font(FONT_PATH, 26)
        font_tip        = _load_font(FONT_PATH, 23)
        font_meta       = _load_font(FONT_PATH, 21)

        temp_dir = tempfile.mkdtemp()
        image_files = []
        total = len(steps)

        for idx, step in enumerate(steps):
            img = Image.new('RGB', (W, H), BG)
            draw = ImageDraw.Draw(img)

            # Top accent bar
            draw.rectangle([0, 0, W, 8], fill=ACCENT)

            # Step badge (top-left)
            badge_text = f"STEP {step.get('step_num', idx+1)} / {total}"
            _draw_rounded_rect(draw, [PAD, 28, PAD + 160, 60], 10, ACCENT)
            draw.text((PAD + 14, 32), badge_text, fill=(255, 255, 255), font=font_step_label)

            # Duration badge (top-right)
            dur = step.get('duration_minutes', 5)
            dur_text = f"⏱  {dur} min"
            draw.text((W - PAD - 120, 32), dur_text, fill=MUTED, font=font_step_label)

            # Title
            title = step.get('title', 'Cooking')
            draw.text((PAD, 78), title, fill=DARK, font=font_title)

            # Divider line
            draw.rectangle([PAD, 132, W - PAD, 134], fill=(220, 220, 215))

            # Description card
            desc = step.get('description', '')
            desc_lines = _wrap_text(desc, font_body, draw, W - PAD * 2 - 40)
            card_h = 20 + len(desc_lines) * 36 + 20
            card_h = min(card_h, 260)
            _draw_rounded_rect(draw, [PAD, 148, W - PAD, 148 + card_h], 12, CARD_BG)
            y = 168
            for line in desc_lines:
                if y + 36 > 148 + card_h:
                    break
                draw.text((PAD + 20, y), line, fill=DARK, font=font_body)
                y += 36

            tip_top = 148 + card_h + 18

            # Tip box
            tip = step.get('tips', '')
            if tip:
                tip_lines = _wrap_text("Tip: " + tip, font_tip, draw, W - PAD * 2 - 50)
                tip_h = 16 + len(tip_lines) * 30 + 16
                tip_h = min(tip_h, 110)
                _draw_rounded_rect(draw, [PAD, tip_top, W - PAD, tip_top + tip_h], 10, TIP_BG)
                draw.rectangle([PAD, tip_top, PAD + 5, tip_top + tip_h], fill=TIP_BORDER)
                ty = tip_top + 16
                for line in tip_lines:
                    if ty + 30 > tip_top + tip_h:
                        break
                    draw.text((PAD + 18, ty), line, fill=(90, 70, 10), font=font_tip)
                    ty += 30
                tools_top = tip_top + tip_h + 14
            else:
                tools_top = tip_top

            # Tools row
            tools = step.get('tools', [])
            if tools:
                draw.text((PAD, tools_top), "Tools:", fill=MUTED, font=font_meta)
                tx = PAD + 75
                for tool in tools[:5]:
                    tw = int(font_meta.getlength(tool)) + 24 if hasattr(font_meta, 'getlength') else 120
                    if tx + tw > W - PAD:
                        break
                    _draw_rounded_rect(draw, [tx, tools_top - 2, tx + tw, tools_top + 26], 8, (230, 230, 225))
                    draw.text((tx + 12, tools_top), tool, fill=DARK, font=font_meta)
                    tx += tw + 10

            # Bottom progress bar
            bar_y = H - 20
            draw.rectangle([0, bar_y, W, H], fill=(220, 220, 215))
            progress = int(W * (idx + 1) / total)
            draw.rectangle([0, bar_y, progress, H], fill=ACCENT)

            img_path = os.path.join(temp_dir, f"step_{idx:03d}.png")
            img.save(img_path)
            image_files.append(img_path)

        if not image_files:
            return False

        list_file = os.path.join(temp_dir, "images.txt")
        with open(list_file, 'w') as f:
            for img_file in image_files:
                f.write(f"file '{img_file}'\nduration 7\n")

        cmd = [
            'ffmpeg', '-y',
            '-f', 'concat', '-safe', '0', '-i', list_file,
            '-vf', 'scale=1280:720,fps=24',
            '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
            '-preset', 'fast',
            str(output_path)
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)

        shutil.rmtree(temp_dir)

        if result.returncode == 0:
            logger.info(f"Video generated: {output_path}")
            return True
        else:
            logger.error(f"FFmpeg error: {result.stderr}")
            return False

    except Exception as e:
        logger.error(f"Video generation failed: {str(e)}")
        return False


def generate_tutorial_video(recipe_name, steps):
    """Generate tutorial video"""
    video_dir = Path('generated_videos')
    video_dir.mkdir(exist_ok=True)

    safe_name = "".join(c for c in recipe_name if c.isalnum() or c in (' ', '-', '_')).strip()
    safe_name = safe_name.replace(' ', '_')[:50]
    video_path = video_dir / f"{safe_name}_{int(time.time())}.mp4"

    success = create_video_from_steps(recipe_name, steps['steps'], str(video_path))

    if success and video_path.exists():
        return f"/videos/{video_path.name}"
    else:
        raise Exception("Video generation failed")


@cooking_guide_bp.route('/api/generate-cooking-guide', methods=['POST'])
def generate_cooking_guide():
    """Generate detailed cooking steps and tutorial video"""
    data = request.get_json()
    recipe_name = data.get('recipe_name', 'Unknown Recipe')
    ingredients = data.get('ingredients', [])
    original_steps = data.get('steps', [])

    try:
        enhanced_steps = optimize_cooking_steps(
            recipe_name,
            ingredients,
            original_steps
        )

        video_url = generate_tutorial_video(
            recipe_name,
            enhanced_steps
        )

        return {
            'success': True,
            'enhanced_steps': enhanced_steps,
            'video_url': video_url
        }, 200
    except Exception as e:
        logger.error(f"Failed to generate tutorial video: {str(e)}")
        return {'success': False, 'error': str(e)}, 500


@cooking_guide_bp.route('/videos/<filename>')
def serve_video(filename):
    """Serve video file"""
    try:
        return send_from_directory(os.path.abspath('generated_videos'), filename)
    except Exception as e:
        logger.error(f"Failed to retrieve video: {str(e)}")
        return {'error': 'Video not found'}, 404
