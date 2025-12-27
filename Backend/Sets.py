from typing import Any, Union
from Definition import make_predicate_tree, Predicate

class Set:
    """
    A set that contains some elements.

    ==Public Attributes==
    name: A string that identifies the set
    element_representations: A list of instantiated <Variable>s that represent the elements of the set.
    latex_form: The latex representation of the set.
    subsets: list of sets that this set is a subset of
    countability: a boolean that indicates if the set is countable or not.
    """

    name: str
    element: list[Any] #TODO create Variable (list[Variable] class)
    condition: Union[None, Predicate]
    subsets: list
    latex_form: str

    def __init__(self, name, element, condition, latex_form) -> None:
        """
        Create and initialize a new set
        """
        self.name = name
        self.element = element
        self.condition = condition
        self.latex_form = latex_form



class Finite_Set(Set):
    """
    A finite set that contains elements.

    ==Public Attributes==
    set: The actual set containing countable elements
    cardinality: the number of elements
    """

    set: Union[set, None]
    cardinality: int

    def __init__(self, name, element, condition, latex_form, set_of_elements) -> None:
        super().__init__(name, element, condition, latex_form)
        self.set = set_of_elements
        if set_of_elements is not None:
            self.cardinality = len(set_of_elements)
        else:
            self.cardinality = 0

    def add_element(self) -> None:
        pass

    def remove_element(self) -> None:
        pass

class Infinite_Set(Set):
    """
    An infinite set that contains elements.
    ==Public Attributes==

    """
def check_set_equality():
    pass





if __name__ == "__main__":
    condition = make_predicate_tree(['P'])

    set = Finite_Set("berries", 'berry', condition, 'berries = ', None)
    print(set.cardinality)
    print(f"we represent elements in {set.name} with the symbol {set.element}")
    print(f"elements in this finite set {set.name} are {set.set}")
    print(f"{set.condition.root}")