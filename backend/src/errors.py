"""One error type that always names the dependency that failed, so the UI can say which."""


class SourceError(Exception):
    def __init__(self, source: str, code: str, message: str, status: int = 502):
        super().__init__(message)
        self.source, self.code, self.message, self.status = source, code, message, status


class BadRequest(SourceError):
    def __init__(self, code: str, message: str, status: int = 400):
        super().__init__("api", code, message, status)
