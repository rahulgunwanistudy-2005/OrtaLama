"""Invalid PDFs must fail before invoking the extraction model."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from pdfminer.pdfdocument import PDFPasswordIncorrect
from reportlab.pdfgen.canvas import Canvas
from services.plant_agent.engine import read_report

class ReportInputs(unittest.TestCase):
    def test_corrupt_pdf_has_a_readable_validation_error(self):
        with tempfile.TemporaryDirectory() as directory:
            p=Path(directory)/'invalid.pdf';p.write_bytes(b'%PDF-1.7\nnot a complete PDF')
            with self.assertRaisesRegex(ValueError,'readable, unencrypted text PDF'):
                read_report(p)

    def test_password_protected_pdf_has_a_readable_validation_error(self):
        with tempfile.TemporaryDirectory() as directory:
            p=Path(directory)/'encrypted.pdf';p.write_bytes(b'%PDF-1.7')
            with patch('services.plant_agent.engine.pdfplumber.open',side_effect=PDFPasswordIncorrect()):
                with self.assertRaisesRegex(ValueError,'readable, unencrypted text PDF'):
                    read_report(p)

    def test_empty_pdf_is_rejected_before_model_work(self):
        with tempfile.TemporaryDirectory() as directory:
            p=Path(directory)/'empty.pdf';Canvas(str(p)).save()
            with self.assertRaisesRegex(ValueError,'empty or scanned'):
                read_report(p)

if __name__=='__main__':unittest.main()
