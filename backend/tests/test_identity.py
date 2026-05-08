from fastapi.testclient import TestClient

from app.main import app


def test_mock_identity_resolution_and_metadata() -> None:
    client = TestClient(app)

    resolve_response = client.get("/identity/resolve/gpu-prague.eth")
    assert resolve_response.status_code == 200
    resolved = resolve_response.json()
    assert resolved["address"] == "0x2000000000000000000000000000000000000002"
    assert resolved["resolver"] == "mock-ens-style-resolver"

    metadata_response = client.get("/identity/gpu-prague.eth/metadata")
    assert metadata_response.status_code == 200
    metadata = metadata_response.json()
    assert metadata["kind"] == "worker"
    assert metadata["name"] == "gpu-prague.eth"
    assert "mock-llama" in metadata["capabilities"]
    assert "must not contain secrets" in metadata["public_record_warning"]
