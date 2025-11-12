import os

def recognize_from_file(_file) -> dict:
    provider = os.getenv("VISION_PROVIDER", "mock")
    # TODO: provider == "google" 时，调用 Google Vision
    return _mock_detect()

def recognize_from_hint(hint: str) -> dict:
    # 用于前期无文件时调试
    return _mock_detect(hint)

def _mock_detect(hint: str = "") -> dict:
    hint = (hint or "").lower()
    if "caprese" in hint or "salad" in hint:
        items = ["tomato", "mozzarella", "basil", "olive oil"]
    elif "japanese" in hint or "roll" in hint:
        items = ["egg", "cucumber", "salt"]
    else:
        items = ["tomato", "egg", "salt", "oil"]
    return {"ingredients": items, "freshness": {i: "fresh" for i in items}}
