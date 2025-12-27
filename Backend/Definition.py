from __future__ import annotations
from typing import Union, Any
from sympy import *

for_all = ' ∀ '
there_exists = ' ∃ '
quantifiers = [for_all, there_exists]


And = ' ∧ '
Not = ' ¬ '
Or = ' ∨ '
Implies = ' ⇒ '
if_and_only_if = ' ⇔ '
connectives = [And, Not, Or, Implies, if_and_only_if]

class Predicate:
    """
    A binary tree. The root with no parent is the final proposition
    """
    # the root would store the real proposition, i.e., for all x, P(x)
    root: Any
    left: Union[None, Predicate]
    right: Union[None, Predicate]

    def __init__(self, info: Union[None, str], left: Union[None, Predicate], right: Union[None, Predicate]) -> None:
        if info is None:
            self.root = None
            self.left = None
            self.right = None
        else:
            self.root = info
            self.left = left
            self.right = right


class Proposition:
    """
    A binary tree. The root with no parent is the final proposition
    """
    # the root would store the real proposition, i.e., for all x, P(x)
    root: Any #TODO decide what Any?
    truth_value: Union[None, bool]
    left: Union[None, Proposition]
    right: Union[None, Proposition]

    def __init__(self, info: Union[None, str], left: Union[None, Proposition], right: Union[None, Proposition], truth_value: Union[None, bool]) -> None:
        if info is None:
            self.root = None
            self.left = None
            self.right = None
            self.truth_value = None
        else:
            self.root = info
            self.left = left
            self.right = right
            self.truth_value = truth_value


class Definition:
    """
    A definition of <object>

    ==Public Attributes==

    object: What this definition is for
    name: the object's new label
    property: the object's new property
    condition: a predicate yet to be called <name>
    property_objects: any objects the predicate needs (i.e., variables, sets, functions etc.)
    latex_form: shows the bi condition arrows (useful for definition unfolding)
    """
    object: Any

    name: Union[None, str]
    property: Union[None, str]

    condition: Predicate
    property_objects: list[Any]

    latex_form: str

    def __init__(self, thing, name, property, condition, property_objects, latex_form) -> None:
        self.object = thing
        self.name = name
        self.property = property
        self.condition = condition
        self.property_objects = property_objects
        self.latex_form = latex_form

    def print_definition(self) -> None:
        second = None
        if self.name is None:
            second = self.property
        elif self.property is None:
            second = self.name

        print(f"An {self.object} is called {second} if {self.condition.root} is satisfied.")


def get_truth(obj: Any) -> bool:
    # TODO
    pass

def make_predicate_tree(full_proposition: list) -> Predicate:
    # For now, I have not placed truth values on to these "propositions"
    # Since this is making a proposition tree, there needs to be a way to check if the previous propositions are correct
    if len(full_proposition) == 1:
        return Predicate(full_proposition[0], None, None)

    else:
        left = make_predicate_tree(full_proposition[0])
        right = make_predicate_tree(full_proposition[2])
        info = left.root + full_proposition[1] + right.root
        return Predicate(info, left, right)

def make_proposition(full_proposition: list) -> Proposition:
    # For now, I have not placed truth values on to these "propositions"
    # Since this is making a proposition tree, there needs to be a way to check if the previous propositions are correct
    if len(full_proposition) == 1:
        truth_value = get_truth(full_proposition[0])
        return Proposition(full_proposition[0], None, None, truth_value)

    else:
        left = make_proposition(full_proposition[0])
        right = make_proposition(full_proposition[2])
        info = left.root + full_proposition[1] + right.root
        return Proposition(info, left, right, None)

if __name__ == "__main__":
    # P and Q are placeholders

    s = make_predicate_tree([[['P'], ' ∧ ', ['Q']], ' ∧ ', ['R']])
    print(s.root)
    odd = Definition(Symbol('n'), 'odd', None, Predicate('n=2p+1', None, None), None, '<insert latex here>')
    odd.print_definition()