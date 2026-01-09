from __future__ import annotations
from typing import Union, List, Tuple, Optional, Any
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from Definition import (
    Proposition, Predicate, 
    And, Not, Or, Implies, if_and_only_if,
    for_all, there_exists, make_proposition
)


class InferenceRule:
    """
    Base class for all inference rules.
    
    ==Public Attributes==
    name: The name of the inference rule
    tautology: The tautology form this rule represents
    """
    name: str
    tautology: str
    
    def __init__(self, name: str, tautology: str = ""):
        self.name = name
        self.tautology = tautology
    
    def apply(self, *args) -> Union[Proposition, Predicate, None]:
        """Apply the inference rule. Must be implemented by subclasses."""
        raise NotImplementedError(f"{self.name} apply() not implemented")
    
    def validate(self, *args) -> bool:
        """Validate if the rule can be applied with given arguments."""
        raise NotImplementedError(f"{self.name} validate() not implemented")
    
    def __repr__(self) -> str:
        return f"InferenceRule({self.name})"


def parse_implication(prop: Proposition) -> Tuple[Optional[str], Optional[str]]:
    """Parse a proposition containing an implication into antecedent and consequent."""
    if Implies not in prop.root:
        return None, None
    parts = prop.root.split(Implies)
    if len(parts) != 2:
        return None, None
    return parts[0].strip(), parts[1].strip()


def parse_disjunction(prop: Proposition) -> Tuple[Optional[str], Optional[str]]:
    """Parse a proposition containing a disjunction."""
    if Or not in prop.root:
        return None, None
    parts = prop.root.split(Or)
    if len(parts) != 2:
        return None, None
    return parts[0].strip(), parts[1].strip()


def parse_conjunction(prop: Proposition) -> Tuple[Optional[str], Optional[str]]:
    """Parse a proposition containing a conjunction."""
    if And not in prop.root:
        return None, None
    parts = prop.root.split(And)
    if len(parts) != 2:
        return None, None
    return parts[0].strip(), parts[1].strip()


def is_negation_of(neg_prop: str, prop: str) -> bool:
    """Check if neg_prop is the negation of prop."""
    neg_prop = neg_prop.strip()
    prop = prop.strip()
    not_symbol = Not.strip()
    
    if neg_prop.startswith(not_symbol):
        return neg_prop[len(not_symbol):].strip() == prop
    return False


def get_negated_content(prop: str) -> Optional[str]:
    """Extract the content after the negation symbol."""
    prop = prop.strip()
    not_symbol = Not.strip()
    if prop.startswith(not_symbol):
        return prop[len(not_symbol):].strip()
    return None


class ModusPonens(InferenceRule):
    """
    Modus Ponens (Law of Detachment):
        p
        p → q
        ∴ q
    
    Tautology: ((p → q) ∧ p) → q
    """
    def __init__(self):
        super().__init__(
            "Modus Ponens",
            f"((p{Implies}q){And}p){Implies}q"
        )
    
    def validate(self, p: Proposition, p_implies_q: Proposition) -> bool:
        antecedent, _ = parse_implication(p_implies_q)
        if antecedent is None:
            return False
        return p.root.strip() == antecedent
    
    def apply(self, p: Proposition, p_implies_q: Proposition) -> Union[Proposition, None]:
        """
        Given p and p→q, conclude q.
        
        :param p: The proposition p
        :param p_implies_q: The proposition p → q
        :return: The proposition q, or None if invalid
        """
        antecedent, consequent = parse_implication(p_implies_q)
        
        if antecedent is None or consequent is None:
            return None
        
        if p.root.strip() == antecedent:
            truth = True if (p.truth_value and p_implies_q.truth_value) else None
            return Proposition(consequent, None, None, truth)
        
        return None


class ModusTollens(InferenceRule):
    """
    Modus Tollens:
        ¬q
        p → q
        ∴ ¬p
    
    Tautology: ((p → q) ∧ ¬q) → ¬p
    """
    def __init__(self):
        super().__init__(
            "Modus Tollens",
            f"((p{Implies}q){And}{Not}q){Implies}{Not}p"
        )
    
    def validate(self, not_q: Proposition, p_implies_q: Proposition) -> bool:
        _, consequent = parse_implication(p_implies_q)
        if consequent is None:
            return False
        return is_negation_of(not_q.root, consequent)
    
    def apply(self, not_q: Proposition, p_implies_q: Proposition) -> Union[Proposition, None]:
        """
        Given ¬q and p→q, conclude ¬p.
        
        :param not_q: The proposition ¬q
        :param p_implies_q: The proposition p → q
        :return: The proposition ¬p, or None if invalid
        """
        antecedent, consequent = parse_implication(p_implies_q)
        
        if antecedent is None or consequent is None:
            return None
        
        if is_negation_of(not_q.root, consequent):
            return Proposition(Not + antecedent, None, None, True)
        
        return None


class HypotheticalSyllogism(InferenceRule):
    """
    Hypothetical Syllogism:
        p → q
        q → r
        ∴ p → r
    
    Tautology: ((p → q) ∧ (q → r)) → (p → r)
    """
    def __init__(self):
        super().__init__(
            "Hypothetical Syllogism",
            f"((p{Implies}q){And}(q{Implies}r)){Implies}(p{Implies}r)"
        )
    
    def validate(self, p_implies_q: Proposition, q_implies_r: Proposition) -> bool:
        _, q1 = parse_implication(p_implies_q)
        q2, _ = parse_implication(q_implies_r)
        if q1 is None or q2 is None:
            return False
        return q1 == q2
    
    def apply(self, p_implies_q: Proposition, q_implies_r: Proposition) -> Union[Proposition, None]:
        """
        Given p→q and q→r, conclude p→r.
        """
        p, q1 = parse_implication(p_implies_q)
        q2, r = parse_implication(q_implies_r)
        
        if None in (p, q1, q2, r):
            return None
        
        if q1 == q2:
            return Proposition(p + Implies + r, None, None, True)
        
        return None


class DisjunctiveSyllogism(InferenceRule):
    """
    Disjunctive Syllogism:
        p ∨ q
        ¬p
        ∴ q
    
    Tautology: ((p ∨ q) ∧ ¬p) → q
    """
    def __init__(self):
        super().__init__(
            "Disjunctive Syllogism",
            f"((p{Or}q){And}{Not}p){Implies}q"
        )
    
    def validate(self, p_or_q: Proposition, not_p: Proposition) -> bool:
        left, right = parse_disjunction(p_or_q)
        if left is None:
            return False
        return is_negation_of(not_p.root, left) or is_negation_of(not_p.root, right)
    
    def apply(self, p_or_q: Proposition, not_p: Proposition) -> Union[Proposition, None]:
        """
        Given p∨q and ¬p, conclude q.
        Also works if given p∨q and ¬q, concluding p.
        """
        left, right = parse_disjunction(p_or_q)
        
        if left is None or right is None:
            return None
        
        if is_negation_of(not_p.root, left):
            return Proposition(right, None, None, True)
        elif is_negation_of(not_p.root, right):
            return Proposition(left, None, None, True)
        
        return None


class Addition(InferenceRule):
    """
    Addition:
        p
        ∴ p ∨ q
    
    Tautology: p → (p ∨ q)
    """
    def __init__(self):
        super().__init__(
            "Addition",
            f"p{Implies}(p{Or}q)"
        )
    
    def validate(self, p: Proposition, q_str: str = "") -> bool:
        return p is not None and p.root is not None
    
    def apply(self, p: Proposition, q_str: str) -> Proposition:
        """
        Given p, conclude p∨q for any q.
        
        :param p: The proposition p
        :param q_str: Any proposition q to add
        :return: The proposition p ∨ q
        """
        return Proposition(p.root + Or + q_str, None, None, p.truth_value)


class Simplification(InferenceRule):
    """
    Simplification:
        p ∧ q
        ∴ p  (or q)
    
    Tautology: (p ∧ q) → p
    """
    def __init__(self):
        super().__init__(
            "Simplification",
            f"(p{And}q){Implies}p"
        )
    
    def validate(self, p_and_q: Proposition) -> bool:
        left, right = parse_conjunction(p_and_q)
        return left is not None and right is not None
    
    def apply(self, p_and_q: Proposition, get_left: bool = True) -> Union[Proposition, None]:
        """
        Given p∧q, conclude p (or q if get_left=False).
        """
        left, right = parse_conjunction(p_and_q)
        
        if left is None or right is None:
            return None
        
        result = left if get_left else right
        return Proposition(result, None, None, p_and_q.truth_value)


class Conjunction(InferenceRule):
    """
    Conjunction:
        p
        q
        ∴ p ∧ q
    
    Tautology: ((p) ∧ (q)) → (p ∧ q)
    """
    def __init__(self):
        super().__init__(
            "Conjunction",
            f"((p){And}(q)){Implies}(p{And}q)"
        )
    
    def validate(self, p: Proposition, q: Proposition) -> bool:
        return p is not None and q is not None
    
    def apply(self, p: Proposition, q: Proposition) -> Proposition:
        """
        Given p and q, conclude p∧q.
        """
        truth = None
        if p.truth_value is not None and q.truth_value is not None:
            truth = p.truth_value and q.truth_value
        return Proposition(p.root + And + q.root, None, None, truth)


class Resolution(InferenceRule):
    """
    Resolution:
        p ∨ q
        ¬p ∨ r
        ∴ q ∨ r
    
    Tautology: ((p ∨ q) ∧ (¬p ∨ r)) → (q ∨ r)
    """
    def __init__(self):
        super().__init__(
            "Resolution",
            f"((p{Or}q){And}({Not}p{Or}r)){Implies}(q{Or}r)"
        )
    
    def validate(self, p_or_q: Proposition, not_p_or_r: Proposition) -> bool:
        left1, right1 = parse_disjunction(p_or_q)
        left2, right2 = parse_disjunction(not_p_or_r)
        
        if None in (left1, right1, left2, right2):
            return False
        
        # Check if one term in second disjunction is negation of term in first
        return (is_negation_of(left2, left1) or is_negation_of(left2, right1) or
                is_negation_of(right2, left1) or is_negation_of(right2, right1))
    
    def apply(self, p_or_q: Proposition, not_p_or_r: Proposition) -> Union[Proposition, None]:
        """
        Given p∨q and ¬p∨r, conclude q∨r.
        """
        left1, right1 = parse_disjunction(p_or_q)
        left2, right2 = parse_disjunction(not_p_or_r)
        
        if None in (left1, right1, left2, right2):
            return None
        
        # Find the complementary pair
        if is_negation_of(left2, left1):
            return Proposition(right1 + Or + right2, None, None, True)
        elif is_negation_of(left2, right1):
            return Proposition(left1 + Or + right2, None, None, True)
        elif is_negation_of(right2, left1):
            return Proposition(right1 + Or + left2, None, None, True)
        elif is_negation_of(right2, right1):
            return Proposition(left1 + Or + left2, None, None, True)
        
        return None


# Singleton instances for convenience
modus_ponens = ModusPonens()
modus_tollens = ModusTollens()
hypothetical_syllogism = HypotheticalSyllogism()
disjunctive_syllogism = DisjunctiveSyllogism()
addition = Addition()
simplification = Simplification()
conjunction = Conjunction()
resolution = Resolution()


if __name__ == "__main__":
    # Test Modus Ponens
    print("=== Testing Modus Ponens ===")
    p = Proposition("p", None, None, True)
    p_implies_q = Proposition(f"p{Implies}q", None, None, True)
    result = modus_ponens.apply(p, p_implies_q)
    print(f"Given: {p.root}")
    print(f"Given: {p_implies_q.root}")
    print(f"Conclusion: {result.root if result else 'None'}")
    
    # Test Disjunctive Syllogism
    print("\n=== Testing Disjunctive Syllogism ===")
    l_or_h = Proposition(f"l{Or}h", None, None, True)
    not_h = Proposition(f"{Not}h", None, None, True)
    result = disjunctive_syllogism.apply(l_or_h, not_h)
    print(f"Given: {l_or_h.root}")
    print(f"Given: {not_h.root}")
    print(f"Conclusion: {result.root if result else 'None'}")
    
    # Test Modus Tollens
    print("\n=== Testing Modus Tollens ===")
    s_implies_not_l = Proposition(f"s{Implies}{Not}l", None, None, True)
    l = Proposition("l", None, None, True)
    not_not_l = Proposition(f"{Not}{Not}l", None, None, True)  # This won't work directly
    # We need l which is equivalent to ¬(¬l)
    result = modus_tollens.apply(Proposition(f"{Not}({Not}l)", None, None, True), s_implies_not_l)
    print(f"Conclusion: {result.root if result else 'None'}")