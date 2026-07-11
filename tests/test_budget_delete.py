from services.budgets import delete_budget


def test_delete_missing_budget_returns_false():
    assert delete_budget(999999999) is False
