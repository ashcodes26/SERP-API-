"""Bounded, request-only UTF-8 TXT / DOCX parsing; no filesystem extraction."""
from io import BytesIO
from pathlib import PurePath
import zipfile
import zlib
from xml.etree import ElementTree

from app.services.serpapi import SearchFailure

MAX_RESUME_BYTES = 1_048_576
DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'


def parse_resume(data: bytes, filename: str, content_type: str | None) -> str:
    if len(data) > MAX_RESUME_BYTES:
        raise SearchFailure('RESUME_TOO_LARGE', 'Resume limit is 1 MiB', 413)
    extension = PurePath(filename).suffix.casefold()
    allowed = {'.txt': {'text/plain', 'application/octet-stream'}, '.docx': {DOCX_MIME, 'application/octet-stream'}}
    if extension not in allowed or (content_type or '').split(';')[0] not in allowed[extension]:
        raise SearchFailure('RESUME_FORMAT_UNSUPPORTED', 'Choose a UTF-8 .txt or .docx resume; PDF is not supported', 415)
    try:
        if extension == '.txt':
            text = data.decode('utf-8-sig')
        else:
            with zipfile.ZipFile(BytesIO(data)) as archive:
                entries = archive.infolist()
                if len(entries) > 200 or sum(i.file_size for i in entries) > 8_000_000 or any(i.flag_bits & 1 for i in entries):
                    raise ValueError('archive limits')
                info = archive.getinfo('word/document.xml')
                if info.file_size > 2_000_000:
                    raise ValueError('document limits')
                xml = archive.read(info).decode('utf-8-sig')
                if '<!DOCTYPE' in xml.upper() or '<!ENTITY' in xml.upper():
                    raise ValueError('unsafe XML')
                root = ElementTree.fromstring(xml)
                ns = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
                text = '\n'.join(''.join(part.text or '' for part in node.iter(ns + 't')) for node in root.iter(ns + 'p'))
        if any(ord(c) < 32 and c not in '\n\r\t' for c in text):
            raise ValueError('binary text')
    except (UnicodeError, ValueError, KeyError, zipfile.BadZipFile, RuntimeError, ElementTree.ParseError, NotImplementedError, zlib.error, OSError):
        raise SearchFailure('RESUME_PARSE_FAILED', 'Resume could not be read; use a valid DOCX or UTF-8 TXT file', 422) from None
    text = text.strip()
    if not 30 <= len(text) <= 20000:
        raise SearchFailure('RESUME_TEXT_LENGTH', 'Parsed resume must contain 30–20,000 characters', 422)
    return text
