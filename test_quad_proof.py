import pytest
from Backend.Definition import *
from Backend.Sets import Set
from Backend.Expression import Variable, Num, Power, BinOp
from Backend.Propositions import Proposition
from Backend.make import make_equation
from Inferences.rules import modus_ponens
from Inferences.quantifier_rules import universal_instantiation

def test_quadratic_root_proof():
    """
    Test the logical proof for a quadratic root.
    Steps:
    1. Instantiate a universal rule.
    2. Apply it to a specific constant.
    3. Verify the arithmetic in the Backend.
    """
    
    # --- STEP 1: Representation (Backend) ---
    # Represent x^2 - 4 = 0
    eqn = make_equation("(x)^(2) = (4)")
    var_x = eqn.left.left # Access the Variable object
    var_x.assign(2)
    
    # Verify the backend can evaluate the power and subtraction
    assert eqn.left.evaluate() == 4
    assert (eqn.left.evaluate() - 4) == 0

    # --- STEP 2: Logical Inference (Inferences) ---
    # Premise: If x is a root, then x^2 - 4 = 0
    p = Proposition("is_root(2)", None, None, True)
    p_implies_q = Proposition("is_root(2) ⇒ 2^2-4=0", None, None, True)
    
    # Use Modus Ponens to derive the conclusion
    conclusion = modus_ponens.apply(p, p_implies_q)
    
    assert conclusion is not None
    assert conclusion.root == "2^2-4=0"
    assert conclusion.truth_value is True

def test_quantifier_instantiation():
    """
    Test converting ∀x P(x) to P(2).
    File: Inferences/quantifier_rules.py
    """
    from Backend.Definition import Predicate
    
    # ∀x(x is a root)
    universal_statement = Predicate(" ∀ x(Root(x))", None, None)
    
    # Apply Universal Instantiation for constant '2'
    instantiated = universal_instantiation.apply(universal_statement, "x", "2")
    
    assert instantiated.root == "Root(2)"