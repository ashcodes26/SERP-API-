from io import BytesIO
from pathlib import Path
import pytest
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, NameObject, DictionaryObject

from app.config import Settings, get_settings
from app.services.candidate_profile import extract_profile
from app.services.intelligence import normalize_skill
from app.services.job_discovery import extract_requirements
from app.services.resume_files import parse_resume
from app.services.serpapi import SearchFailure


def pdf_bytes(text='Alex Synthetic Student has built a Python and SQL project.', encrypted=False, pages=1):
    writer = PdfWriter()
    for _ in range(pages):
        page = writer.add_blank_page(width=612, height=792)
        if text:
            stream = DecodedStreamObject()
            stream.set_data(('BT /F1 12 Tf 30 700 Td (' + text + ') Tj ET').encode('ascii'))
            page[NameObject('/Contents')] = writer._add_object(stream)
            font = DictionaryObject({NameObject('/Type'): NameObject('/Font'), NameObject('/Subtype'): NameObject('/Type1'), NameObject('/BaseFont'): NameObject('/Helvetica')})
            page[NameObject('/Resources')] = DictionaryObject({NameObject('/Font'): DictionaryObject({NameObject('/F1'): writer._add_object(font)})})
    if encrypted:
        writer.encrypt('synthetic-test-password')
    output = BytesIO(); writer.write(output)
    return output.getvalue()


def test_pdf_real_text_scan_encryption_and_page_limits():
    assert 'Python' in parse_resume(pdf_bytes(), 'r.pdf', 'application/pdf')
    for content, code in [(pdf_bytes(text=''), 'RESUME_OCR_REQUIRED'),
                          (pdf_bytes(encrypted=True), 'RESUME_ENCRYPTED'),
                          (pdf_bytes(pages=31), 'RESUME_PAGE_LIMIT'),
                          (b'%PDF-1.7 corrupt', 'RESUME_PARSE_FAILED'),
                          (b'filename is not a PDF', 'RESUME_PARSE_FAILED')]:
        with pytest.raises(SearchFailure) as caught:
            parse_resume(content, 'r.pdf', 'application/pdf')
        assert caught.value.code == code
    with pytest.raises(SearchFailure):
        parse_resume(pdf_bytes(), 'r.docx', 'application/octet-stream')


def test_pdf_decompression_limits_are_enforced_before_extraction():
    writer = PdfWriter(); page = writer.add_blank_page(width=612, height=792)
    stream = DecodedStreamObject(); stream.set_data(b'x' * 4_000_001)
    page[NameObject('/Contents')] = writer._add_object(stream.flate_encode())
    output = BytesIO(); writer.write(output)
    assert len(output.getvalue()) < 1_048_576
    with pytest.raises(SearchFailure) as caught:
        parse_resume(output.getvalue(), 'bomb.pdf', 'application/pdf')
    assert caught.value.code == 'RESUME_PARSE_FAILED'


def test_structured_extraction_aliases_sources_unknown_and_conflicts():
    resume = 'Name: Alex Student\nSummary: Career student\nSkills: JavaScript, Java, MS Excel, NLP, Natural Language Processing\nProjects: Built a Python project in Jan 2024.\nEducation: BSc, 2022\nCertifications: Supplied certificate\nInternships: Intern, 2023\nAchievements: Supplied award\nPortfolio: https://github.com/alex\nSkills: Want to learn Docker'
    profile = extract_profile([(resume, 'resume', False), ('Name: Alexis Student\nProjects: Built a Python project in Jan 2024.', 'linkedin_self_provided', True)])
    assert {s.name for s in profile.skills} == {'Java', 'JavaScript', 'Microsoft Excel', 'NLP', 'Python'}
    assert all(s.level is None for s in profile.skills)
    assert len(next(s for s in profile.skills if s.name == 'Python').sources) == 2
    assert profile.fields['certifications'][0].value == 'Supplied certificate'
    assert profile.fields['dates'][0].value == 'Jan 2024'
    assert profile.conflicts == ['full_name']
    assert not profile.fields['linkedin_urls']
    assert normalize_skill(' MS Excel ') == ('Microsoft Excel', 'Data')
    assert normalize_skill('Java')[0] != normalize_skill('JavaScript')[0]
    assert not extract_profile([('https://github.com/python/docker', 'resume', False)]).skills
    aliases = extract_profile([('Skills: ML, Machine Learning, JS and JavaScript', 'resume', False)])
    assert [skill.name for skill in aliases.skills] == ['JavaScript', 'Machine Learning']
