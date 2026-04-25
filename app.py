"""
MAT102 Proof API Server (Transformers Version: Qwen 3.0 0.6B)
=============================================================
This Flask application uses the Hugging Face transformers library to load the 
Qwen 3.0 0.6B model into memory. It handles the JSON-formatted MAT102 proof 
evaluation using the instruction-tuned model to ensure proper system prompt adherence.

Dependencies:
    pip install flask flask-cors transformers torch accelerate
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import re
from transformers import AutoTokenizer, AutoModelForCausalLM

app = Flask(__name__)
CORS(app) # Allow frontend to communicate with backend

print("Loading Qwen 3.0 0.6B model... (This happens once at startup)")

# 1. Model Selection
# The Instruct version is strictly required to follow the JSON formatting rules.
model_id = "Qwen/Qwen3-0.6B"

# 2. Load Tokenizer and Model
# Using AutoModelForCausalLM because this is a pure text-generation task.
tokenizer = AutoTokenizer.from_pretrained(model_id)
model = AutoModelForCausalLM.from_pretrained(
    model_id,
    device_map="auto",    # Automatically maps to GPU if available, else CPU
    torch_dtype="auto"    # Uses the most efficient memory format
)
print("Model loaded successfully! Server is ready.")

@app.route('/verify', methods=['POST'])
def verify_proof():
    """
    Accepts a JSON payload containing the mathematical statement and proof,
    evaluates it using Qwen 3.0 0.6B, and returns formatted JSON feedback.
    """
    data = request.json
    statement = data.get('statement', '')
    proof = data.get('proof', '')

    # 3. Inject MAT102 System Prompt
    system_prompt = """You are a strict MAT102 grading assistant. Evaluate the proof in THREE categories: Logic, Grammar, and Format.

    CRITICAL INSTRUCTIONS:
    - You MUST return a single, valid JSON object. No markdown, no conversational text.
    - Do not solve the proof. Only point out flaws.

    Return your response using this EXACT JSON schema:
    {
    "structured_evaluation": {
        "logic_analysis": "Write a detailed paragraph explaining the logical flow and any major logical failures here.",
        "grammar_analysis": "Write a paragraph evaluating mathematical language and clarity.",
        "format_analysis": "Write a paragraph evaluating proof structure, definitions, and conventions."
    },
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

    If there are no specific errors to list, leave the "errors" array empty: []"""

    user_content = f"STATEMENT TO PROVE:\n{statement}\n\nPROOF ATTEMPT:\n{proof}"

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content}
    ]

    # 4. Apply Chat Template
    # Formats the messages into the specific token structure Qwen expects
    text_prompt = tokenizer.apply_chat_template(
        messages, 
        tokenize=False, 
        add_generation_prompt=True
    )
    
    inputs = tokenizer([text_prompt], return_tensors="pt").to(model.device)

    # 5. Generate AI Response
    # temperature=0.1 ensures the output is highly deterministic for JSON parsing
    outputs = model.generate(
        **inputs, 
        max_new_tokens=512, 
        temperature=0.1, 
        do_sample=False
    )
    
    # Slice the output to remove the prompt tokens
    generated_ids = outputs[0][inputs["input_ids"].shape[-1]:]
    raw_response = tokenizer.decode(generated_ids, skip_special_tokens=True)

    # 6. Safely Extract JSON using Regex
    # We now search for a JSON object {} instead of an array []
    try:
        json_match = re.search(r'\{.*\}', raw_response, re.DOTALL)
        if json_match:
            return jsonify(json.loads(json_match.group(0)))
        
        # Failsafe if the model completely hallucinated
        return jsonify({"structured_evaluation": {"logic_analysis": "Failed to parse AI output.", "grammar_analysis": "", "format_analysis": ""}, "errors": []})
        
    except json.JSONDecodeError:
        print(f"Failed to parse JSON. Raw output: {raw_response}")
        return jsonify({"structured_evaluation": {"logic_analysis": "JSON format error.", "grammar_analysis": "", "format_analysis": ""}, "errors": []})

if __name__ == '__main__':
    # Runs the server locally on port 5000
    app.run(port=5000)