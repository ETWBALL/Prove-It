"""
MAT102 Proof API Server (Transformers Client-Server Version)
============================================================
This Flask application loads Qwen 3.0 0.6B into memory and exposes a /verify endpoint.
It includes a strict string-sanitization pipeline to prevent JSON decoding errors
and prints all outputs to the terminal for debugging and monitoring.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import re
from transformers import AutoTokenizer, AutoModelForCausalLM

app = Flask(__name__)
# Allow the local HTML file to communicate with this backend
CORS(app) 

print("Loading Qwen 3.0 0.6B model... (This happens once at startup)")

model_id = "Qwen/Qwen3-0.6B"
tokenizer = AutoTokenizer.from_pretrained(model_id)
model = AutoModelForCausalLM.from_pretrained(
    model_id,
    device_map="auto",    
    torch_dtype="auto"    
)
print("Model loaded successfully! Server is ready on http://127.0.0.1:5000")

@app.route('/verify', methods=['POST'])
def verify_proof():
    data = request.json
    statement = data.get('statement', '')
    proof = data.get('proof', '')

    print("\n" + "="*50)
    print("NEW REQUEST RECEIVED")
    print(f"Statement: {statement}")
    print("="*50)

    # Flattened JSON Schema to prevent nested parsing errors
    system_prompt = """You are a strict MAT102 grading assistant. 
CRITICAL INSTRUCTION: You MUST return a single, valid JSON object. Do not wrap it in markdown blockquotes. Never use double quotes inside your analysis paragraphs; use single quotes instead.

Use this EXACT flat JSON schema:
{
  "logic_analysis": "Write a detailed paragraph explaining the logical flow and any major logical failures here.",
  "grammar_analysis": "Write a paragraph evaluating mathematical language and clarity.",
  "format_analysis": "Write a paragraph evaluating proof structure, definitions, and conventions.",
  "errors": [
    {
      "id": "error_1",
      "type": "logic",
      "title": "Invalid Deduction",
      "description": "Short description of the specific error.",
      "line": 2
    }
  ]
}

If there are no specific line errors, leave the "errors" array empty: []"""

    user_content = f"STATEMENT TO PROVE:\n{statement}\n\nPROOF ATTEMPT:\n{proof}"

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content}
    ]

    text_prompt = tokenizer.apply_chat_template(
        messages, 
        tokenize=False, 
        add_generation_prompt=True
    )
    
    inputs = tokenizer([text_prompt], return_tensors="pt").to(model.device)

    print("\n--- GENERATING RESPONSE (Please wait) ---")
    
    # 2048 tokens to allow reasoning models to finish their <think> blocks
    outputs = model.generate(
        **inputs, 
        max_new_tokens=2048, 
        do_sample=False
    )
    
    generated_ids = outputs[0][inputs["input_ids"].shape[-1]:]
    raw_response = tokenizer.decode(generated_ids, skip_special_tokens=True)

    print(f"RAW MODEL OUTPUT:\n{raw_response}\n")

    # --- Sanitization Pipeline ---
    # 1. Strip <think> tags
    clean_response = re.sub(r'<think>.*?</think>', '', raw_response, flags=re.DOTALL)
    clean_response = re.sub(r'<think>.*', '', clean_response, flags=re.DOTALL)

    # 2. Strip Markdown formatting
    clean_response = clean_response.replace("```json", "").replace("```", "").strip()

    # 3. Sanitize unescaped internal double quotes
    clean_response = re.sub(r'(?<![:{\[,])"(?![:,}\]])', "'", clean_response)

    print(f"CLEANED JSON OUTPUT:\n{clean_response}\n---------------------------\n")

    try:
        json_match = re.search(r'\{.*\}', clean_response, re.DOTALL)
        if json_match:
            parsed_data = json.loads(json_match.group(0))
            
            # Map the flat JSON back into the nested structure the frontend expects
            return jsonify({
                "structured_evaluation": {
                    "logic_analysis": parsed_data.get("logic_analysis", "No analysis provided."),
                    "grammar_analysis": parsed_data.get("grammar_analysis", "No analysis provided."),
                    "format_analysis": parsed_data.get("format_analysis", "No analysis provided.")
                },
                "errors": parsed_data.get("errors", [])
            })
            
        print("ERROR: Regex failed to find a JSON object in the cleaned text.")
        return jsonify({"structured_evaluation": {"logic_analysis": "Failed to parse AI output.", "grammar_analysis": "", "format_analysis": ""}, "errors": []})
        
    except json.JSONDecodeError as e:
        print(f"JSON PARSING ERROR: {e}")
        return jsonify({"structured_evaluation": {"logic_analysis": "JSON format error. Check backend terminal.", "grammar_analysis": "", "format_analysis": ""}, "errors": []})

if __name__ == '__main__':
    app.run(port=5000)