"""
MAT102 Proof API Server
=======================
This Flask application loads the Qwen 3.5 0.8B model into memory at startup
and exposes a /verify endpoint for the index.html frontend to communicate with.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import re
from transformers import AutoProcessor, AutoModelForImageTextToText

app = Flask(__name__)
CORS(app) # Allows the frontend HTML to make requests to this backend

print("Loading Qwen model... (This will take a minute, but only happens once)")
model_id = "Qwen/Qwen3.5-0.8B"
processor = AutoProcessor.from_pretrained(model_id)
model = AutoModelForImageTextToText.from_pretrained(
    model_id,
    device_map="auto",
    torch_dtype="auto"
)
print("Model loaded successfully! Server is ready.")

@app.route('/verify', methods=['POST'])
def verify_proof():
    """
    Accepts a JSON payload containing the mathematical statement and proof,
    evaluates it using the pre-loaded Qwen model, and returns formatted feedback.
    """
    data = request.json
    statement = data.get('statement', '')
    proof = data.get('proof', '')

    system_prompt = """Your task is to identify errors in THREE categories:
1. **LOGIC ERRORS**
2. **GRAMMAR/WORDING ERRORS**
3. **FORMAT ERRORS**

Return your response as a JSON array with this exact format:
[
  {
    "id": "error_1",
    "type": "logic",
    "title": "Error Title",
    "description": "Detailed description of the error",
    "line": 5
  }
]

CRITICAL INSTRUCTIONS:
- Return ONLY the JSON array, no additional text
- Use "logic", "grammar", or "format"
- Include line numbers where possible
- Be specific and constructive
- If there are no errors, return an empty array: []"""

    user_content = f"STATEMENT TO PROVE:\n{statement}\n\nPROOF ATTEMPT:\n{proof}"

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": [{"type": "text", "text": user_content}]}
    ]

    text_prompt = processor.apply_chat_template(messages, add_generation_prompt=True, tokenize=False)
    inputs = processor(text=[text_prompt], return_tensors="pt", padding=True).to(model.device)

    outputs = model.generate(**inputs, max_new_tokens=512, temperature=0.1, do_sample=False)
    generated_ids = outputs[0][inputs["input_ids"].shape[-1]:]
    raw_response = processor.decode(generated_ids, skip_special_tokens=True)

    try:
        json_match = re.search(r'\[.*\]', raw_response, re.DOTALL)
        if json_match:
            return jsonify(json.loads(json_match.group(0)))
        return jsonify([])
    except json.JSONDecodeError:
        return jsonify([])

if __name__ == '__main__':
    # Runs the server locally on port 5000
    app.run(port=5000)