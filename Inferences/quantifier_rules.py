from __future__ import annotations
from typing import Union, List, Tuple, Optional, Any
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Fix: Import from the correct files within Backend
from Backend.Definition import Predicate #
from Backend.Propositions import Proposition, make_proposition #
from Backend.Propositions import And, Not, Or, Implies, if_and_only_if #
from Backend.Propositions import for_all, there_exists #
from rules import InferenceRule


class QuantifiedInferenceRule(InferenceRule):
    """Base class for quantified inference rules."""
    
    def __init__(self, name: str, tautology: str = ""):
        super().__init__(name, tautology)


def extract_quantifier_parts(root: str, quantifier: str) -> tuple:
    """
    Extract variable and predicate from a quantified expression.
    Returns (variable, predicate_body) or (None, None) if parsing fails.
    """
    if quantifier not in root:
        return None, None
    
    idx = root.find(quantifier) + len(quantifier)
    rest = root[idx:].strip()
    
    # Find the bound variable (usually single character or until special char)
    var_end = 0
    for i, c in enumerate(rest):
        if c in '([ ' or not c.isalnum():
            var_end = i
            break
        var_end = i + 1
    
    if var_end == 0:
        return None, None
    
    variable = rest[:var_end]
    predicate = rest[var_end:].strip()
    
    return variable, predicate


class UniversalInstantiation(QuantifiedInferenceRule):
    """
    Universal Instantiation:
        ∀xP(x)
        ∴ P(c)  [for any c in the domain]
    """
    def __init__(self):
        super().__init__(
            "Universal Instantiation",
            f"{for_all}xP(x) → P(c)"
        )
    
    def validate(self, universal: Predicate, variable: str, constant: str) -> bool:
        var, _ = extract_quantifier_parts(universal.root, for_all)
        return var is not None and var == variable
    
    def apply(self, universal: Predicate, variable: str, constant: str) -> Union[Predicate, None]:
        """
        Given ∀xP(x), conclude P(c) for any constant c.
        
        :param universal: The universally quantified predicate
        :param variable: The bound variable (e.g., 'x')
        :param constant: The constant to substitute (e.g., 'c', 'bob')
        :return: The instantiated predicate P(c)
        """
        var, predicate = extract_quantifier_parts(universal.root, for_all)
        
        if var is None or var != variable:
            return None
        
        # Replace the variable with the constant
        new_predicate = predicate.replace(variable, constant)
        return Predicate(new_predicate, None, None)


class UniversalGeneralization(QuantifiedInferenceRule):
    """
    Universal Generalization:
        P(c)  [for an arbitrary c]
        ∴ ∀xP(x)
    
    NOTE: c must be arbitrary (not a specific named constant)
    """
    def __init__(self):
        super().__init__(
            "Universal Generalization",
            "P(c) [arbitrary c] → ∀xP(x)"
        )
        self.arbitrary_constants: set = set()
    
    def mark_as_arbitrary(self, constant: str) -> None:
        """Mark a constant as arbitrary (can be used for universal generalization)."""
        self.arbitrary_constants.add(constant)
    
    def is_arbitrary(self, constant: str) -> bool:
        """Check if a constant is marked as arbitrary."""
        return constant in self.arbitrary_constants
    
    def validate(self, predicate: Predicate, constant: str, is_arbitrary: bool = False) -> bool:
        return is_arbitrary or self.is_arbitrary(constant)
    
    def apply(self, predicate: Predicate, constant: str, variable: str, 
              is_arbitrary: bool = False) -> Union[Predicate, None]:
        """
        Given P(c) for arbitrary c, conclude ∀xP(x).
        
        :param predicate: The predicate P(c)
        :param constant: The arbitrary constant c
        :param variable: The variable to use in quantification
        :param is_arbitrary: Whether c is truly arbitrary
        :return: The universally quantified predicate, or None if invalid
        """
        if not is_arbitrary and not self.is_arbitrary(constant):
            print(f"Warning: {constant} is not marked as arbitrary. "
                  f"Universal generalization may be invalid.")
            return None
        
        new_predicate = predicate.root.replace(constant, variable)
        return Predicate(for_all + variable + new_predicate, None, None)


class ExistentialInstantiation(QuantifiedInferenceRule):
    """
    Existential Instantiation:
        ∃xP(x)
        ∴ P(c)  [for some particular c, fresh constant]
    
    NOTE: c must be a fresh constant not used elsewhere
    """
    def __init__(self):
        super().__init__(
            "Existential Instantiation",
            f"{there_exists}xP(x) → P(c) [particular c]"
        )
        self.used_constants: set = set()
    
    def get_fresh_constant(self, base: str = "c") -> str:
        """Generate a fresh constant name."""
        if base not in self.used_constants:
            self.used_constants.add(base)
            return base
        
        counter = 1
        while f"{base}{counter}" in self.used_constants:
            counter += 1
        
        fresh = f"{base}{counter}"
        self.used_constants.add(fresh)
        return fresh
    
    def validate(self, existential: Predicate, variable: str) -> bool:
        var, _ = extract_quantifier_parts(existential.root, there_exists)
        return var is not None and var == variable
    
    def apply(self, existential: Predicate, variable: str, 
              constant: Optional[str] = None) -> Union[Predicate, None]:
        """
        Given ∃xP(x), conclude P(c) for some particular c.
        
        :param existential: The existentially quantified predicate
        :param variable: The bound variable
        :param constant: Optional specific constant (will generate fresh if None)
        :return: The instantiated predicate P(c)
        """
        var, predicate = extract_quantifier_parts(existential.root, there_exists)
        
        if var is None or var != variable:
            return None
        
        if constant is None:
            constant = self.get_fresh_constant()
        else:
            self.used_constants.add(constant)
        
        new_predicate = predicate.replace(variable, constant)
        return Predicate(new_predicate, None, None)


class ExistentialGeneralization(QuantifiedInferenceRule):
    """
    Existential Generalization:
        P(c)  [for some particular c]
        ∴ ∃xP(x)
    """
    def __init__(self):
        super().__init__(
            "Existential Generalization",
            f"P(c) → {there_exists}xP(x)"
        )
    
    def validate(self, predicate: Predicate, constant: str) -> bool:
        return constant in predicate.root
    
    def apply(self, predicate: Predicate, constant: str, variable: str) -> Predicate:
        """
        Given P(c) for some particular c, conclude ∃xP(x).
        
        :param predicate: The predicate P(c)
        :param constant: The particular constant c
        :param variable: The variable to use in quantification
        :return: The existentially quantified predicate
        """
        new_predicate = predicate.root.replace(constant, variable)
        return Predicate(there_exists + variable + new_predicate, None, None)


class QuantifierNegation(QuantifiedInferenceRule):
    """
    Quantifier Negation (De Morgan's Laws for Quantifiers):
        ¬∀xP(x) ≡ ∃x¬P(x)
        ¬∃xP(x) ≡ ∀x¬P(x)
    """
    def __init__(self):
        super().__init__(
            "Quantifier Negation",
            f"{Not}{for_all}xP(x) ≡ {there_exists}x{Not}P(x)"
        )
    
    def validate(self, predicate: Predicate) -> bool:
        root = predicate.root.strip()
        not_symbol = Not.strip()
        
        if root.startswith(not_symbol):
            rest = root[len(not_symbol):].strip()
            return for_all in rest or there_exists in rest
        return False
    
    def apply(self, predicate: Predicate) -> Union[Predicate, None]:
        """
        Apply quantifier negation rules.
        ¬∀xP(x) → ∃x¬P(x)
        ¬∃xP(x) → ∀x¬P(x)
        """
        root = predicate.root.strip()
        not_symbol = Not.strip()
        
        if not root.startswith(not_symbol):
            return None
        
        rest = root[len(not_symbol):].strip()
        
        # Case: ¬∀xP(x) → ∃x¬P(x)
        if for_all in rest:
            var, pred = extract_quantifier_parts(rest, for_all)
            if var is None:
                return None
            return Predicate(there_exists + var + Not + pred, None, None)
        
        # Case: ¬∃xP(x) → ∀x¬P(x)
        if there_exists in rest:
            var, pred = extract_quantifier_parts(rest, there_exists)
            if var is None:
                return None
            return Predicate(for_all + var + Not + pred, None, None)
        
        return None


# Singleton instances
universal_instantiation = UniversalInstantiation()
universal_generalization = UniversalGeneralization()
existential_instantiation = ExistentialInstantiation()
existential_generalization = ExistentialGeneralization()
quantifier_negation = QuantifierNegation()


if __name__ == "__main__":
    # Test Universal Instantiation
    print("=== Testing Universal Instantiation ===")
    forall_p = Predicate(f"{for_all}x(P(x){Implies}H(x){Or}L(x))", None, None)
    result = universal_instantiation.apply(forall_p, "x", "b")
    print(f"Given: {forall_p.root}")
    print(f"Conclusion: {result.root if result else 'None'}")
    
    # Test Quantifier Negation
    print("\n=== Testing Quantifier Negation ===")
    not_forall = Predicate(f"{Not}{for_all}wH(b,w)", None, None)
    result = quantifier_negation.apply(not_forall)
    print(f"Given: {not_forall.root}")
    print(f"Conclusion: {result.root if result else 'None'}")