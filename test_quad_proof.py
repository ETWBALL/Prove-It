import pytest
import sys
import os

# Add the project root to sys.path so 'Backend' and 'Inferences' are found
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__))) #

from Backend.Definition import Predicate #
from Backend.Expression import Variable, Num, Power, BinOp #
from Backend.Propositions import Proposition #
from Backend.make import make_equation #
from Inferences.rules import modus_ponens #
from Inferences.quantifier_rules import universal_instantiation #

def test_quadratic_root_proof():
    """
    Test the logical proof for a quadratic root.
    Uses: Backend/make.py, Backend/Expression.py, Inferences/rules.py
    """
    # 1. Representation: x^2 = 4
    eqn = make_equation("(x)^(2) = (4)") 
    var_x = eqn.left.left 
    var_x.assign(2) #
    
    # 2. Arithmetic Check
    assert eqn.left.evaluate() == 4 
    assert (eqn.left.evaluate() - 4) == 0

    # 3. Logical Inference
    p = Proposition("is_root(2)", None, None, True)
    p_implies_q = Proposition("is_root(2) ⇒ 2^2-4=0", None, None, True)
    
    conclusion = modus_ponens.apply(p, p_implies_q)
    
    assert conclusion is not None
    assert "2^2-4=0" in conclusion.root 
    assert conclusion.truth_value is True

def test_quantifier_instantiation():
    """
    Test converting ∀x Root(x) to Root(2).
    Uses: Inferences/quantifier_rules.py
    """
    # ∀x(Root(x))
    universal_statement = Predicate(" ∀ x(Root(x))", None, None)
    
    # Apply Universal Instantiation
    instantiated = universal_instantiation.apply(universal_statement, "x", "2")
    
    assert instantiated.root == "Root(2)"