"""
MAT102 Proof Evaluator - JSON Output
====================================
This script uses the Qwen 3.5 0.8B model to evaluate mathematical proofs.
It integrates a strict system prompt and uses Regex to guarantee the 
output is parseable JSON, even if the model hallucinates conversational padding.

Dependencies:
    pip install transformers torch
"""

import json
import re
from typing import List, Dict, Any
from transformers import AutoProcessor, AutoModelForImageTextToText

def evaluate_proof(statement: str, proof: str) -> List[Dict[str, Any]]:
    """
    Evaluates a mathematical proof using Qwen 3.5 and strictly extracts a JSON array.
    
    Args:
        statement (str): The mathematical theorem or statement.
        proof (str): The student's submitted proof.
        
    Returns:
        List[Dict[str, Any]]: Parsed JSON array of format, logic, and grammar errors.
    """
    model_id = "Qwen/Qwen3.5-0.8B"
    
    # Initialize hardware-optimized model and processor
    processor = AutoProcessor.from_pretrained(model_id)
    model = AutoModelForImageTextToText.from_pretrained(
        model_id,
        device_map="auto",
        torch_dtype="auto"
    )

    # Inject your MAT102 prompt criteria
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

    # Format pure text payload (no image tokens)
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": [{"type": "text", "text": user_content}]}
    ]

    text_prompt = processor.apply_chat_template(
        messages,
        add_generation_prompt=True,
        tokenize=False
    )

    inputs = processor(text=[text_prompt], return_tensors="pt", padding=True).to(model.device)

    # Generate response with low temperature for strict formatting
    outputs = model.generate(
        **inputs, 
        max_new_tokens=512,
        temperature=0.1, 
        do_sample=False
    )
    
    # Strip the prompt from the output
    generated_ids = outputs[0][inputs["input_ids"].shape[-1]:]
    raw_response = processor.decode(generated_ids, skip_special_tokens=True)

    # Safely extract the JSON array using Regex to ignore conversational padding
    try:
        json_match = re.search(r'\[.*\]', raw_response, re.DOTALL)
        if json_match:
            return json.loads(json_match.group(0))
        else:
            return [] # Failsafe empty array
    except json.JSONDecodeError:
        print(f"JSON Parsing Error. Model output was: {raw_response}")
        return []

if __name__ == "__main__":
    # Example execution
    test_statement = "If n is an even integer, then n^2 is even."
    test_proof = "1. Assume n is even.\n2. Therefore n^2 = 2k.\n3. So it is even."
    
    feedback = evaluate_proof(test_statement, test_proof)
    print(json.dumps(feedback, indent=2))