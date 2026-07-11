from services.support import answer_support


def test_informational_answer_uses_approved_source():
    result = answer_support("¿Qué documentos necesito para actualizar mis datos?")
    assert result["intent"] == "informational"
    assert result["requires_human"] is False
    assert result["sources"]
    assert result["sources"][0].startswith("KB-001")


def test_unrecognized_transaction_is_escalated():
    result = answer_support("No reconozco una operación de $320 y quiero reclamar")
    assert result["intent"] == "sensitive"
    assert result["requires_human"] is True
    assert result["priority"] == "HIGH"


def test_unknown_question_abstains_instead_of_inventing():
    result = answer_support("¿Cuál será el precio del oro mañana?")
    assert result["intent"] == "unknown"
    assert result["requires_human"] is True
    assert "No encontré" in result["answer"]


def test_document_difference_is_detected():
    result = answer_support("Hay una diferencia en mi estado de cuenta y un documento faltante")
    assert result["case_type"] == "document_issue"
    assert result["priority"] == "MEDIUM"
