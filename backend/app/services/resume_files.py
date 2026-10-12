"""Bounded, request-only TXT / DOCX / text PDF parsing; no file retention."""
from io import BytesIO
from pathlib import PurePath
import zipfile
import zlib
from xml.etree import ElementTree
from pypdf import PdfReader, apply_configuration
from pypdf.errors import PyPdfError

from app.services.serpapi import SearchFailure

MAX_RESUME_BYTES = 1_048_576
DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'


def pdf_text(data: bytes) -> str:
    if not data.startswith(b'%PDF-'):
        raise ValueError('invalid PDF signature')
    # Context-local limits also bound decompression before get_data returns.
    with apply_configuration(zlib_maximum_output_length=4_000_000, lzw_maximum_output_length=4_000_000,
                             run_length_maximum_output_length=4_000_000, maximum_declared_stream_length=4_000_000,
                             array_based_stream_maximum_output_length=4_000_000, stream_filters_maximum_length=4,
                             stream_decoding_work_maximum_length=8_000_000, page_tree_maximum_entries=1000,
                             page_tree_maximum_depth=20, xform_maximum_invocations_per_extraction=100,
                             jbig2dec_binary=None):
        reader = PdfReader(BytesIO(data), strict=True)
        if reader.is_encrypted:
            raise SearchFailure('RESUME_ENCRYPTED', 'Remove PDF password protection and upload again', 422)
        if len(reader.pages) > 30:
            raise SearchFailure('RESUME_PAGE_LIMIT', 'Choose a PDF with at most 30 pages', 422)
        pages = []
        for page in reader.pages:
            content = page.get_contents()
            if content is not None and len(content.get_data()) > 4_000_000:
                raise ValueError('PDF stream limit')
            pages.append(page.extract_text() or '')
            if sum(map(len, pages)) > 20000:
                raise SearchFailure('RESUME_TEXT_LENGTH', 'Parsed resume must contain 30–20,000 characters', 422)
        text = '\n'.join(pages)
        if len(text.strip()) < 30:
            raise SearchFailure('RESUME_OCR_REQUIRED', 'PDF has insufficient selectable text. Export a text PDF or paste the text; scanned pages require OCR, which is not configured.', 422)
        return text


def parse_resume(data: bytes, filename: str, content_type: str | None) -> str:
    if len(data) > MAX_RESUME_BYTES:
        raise SearchFailure('RESUME_TOO_LARGE', 'Resume limit is 1 MiB', 413)
    extension = PurePath(filename).suffix.casefold()
    allowed = {'.txt': {'text/plain', 'application/octet-stream'}, '.docx': {DOCX_MIME, 'application/octet-stream'},
               '.pdf': {'application/pdf', 'application/octet-stream'}}
    if extension not in allowed or (content_type or '').split(';')[0] not in allowed[extension]:
        raise SearchFailure('RESUME_FORMAT_UNSUPPORTED', 'Choose a text PDF, DOCX or UTF-8 TXT file', 415)
    try:
        if extension == '.txt':
            text = data.decode('utf-8-sig')
        elif extension == '.pdf':
            text = pdf_text(data)
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
    except (UnicodeError, ValueError, KeyError, zipfile.BadZipFile, RuntimeError, ElementTree.ParseError, NotImplementedError, zlib.error, OSError, PyPdfError, RecursionError):
        raise SearchFailure('RESUME_PARSE_FAILED', 'Document could not be read; use a valid text PDF, DOCX or UTF-8 TXT file', 422) from None
    text = text.strip()
    if not 30 <= len(text) <= 20000:
        raise SearchFailure('RESUME_TEXT_LENGTH', 'Parsed resume must contain 30–20,000 characters', 422)
    return text
