"""Report schema is deliberately narrow: grey clinker, direct fossil/process CO2."""
from pydantic import BaseModel, ConfigDict, Field, create_model

# Labels and units are application schema, not emission factors.
FIELDS = {
    'E': ('Toplam doğrudan CO2 emisyonu', 'kg CO2'),
    'P': ('Gri klinker üretimi', 'kg klinker'),
    'cao': ('Karbonat kaynaklı CaO oranı', '%'),
    'mgo': ('Karbonat kaynaklı MgO oranı', '%'),
    'ckd': ('Kayıp kalsine fırın tozu düzeltmesi', '%'),
    'petcoke': ('Petrokok enerji tüketimi', 'TJ NCV'),
    'coal': ('Bitümlü kömür enerji tüketimi', 'TJ NCV'),
    'gas': ('Doğal gaz enerji tüketimi', 'TJ NCV'),
    'thermal': ('Toplam fırın ısıl enerji tüketimi', 'TJ NCV'),
    'previous': ('Önceki yıl doğrudan emisyon yoğunluğu', 'kg CO2/kg klinker'),
}


class Strict(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)


class Citation(Strict):
    rawValue: str = Field(min_length=1, max_length=32)
    page: int = Field(ge=1, le=100)
    line: int = Field(ge=1, le=500)


ExtractedFields = create_model('ExtractedFields', __base__=Strict, **{name: (Citation, ...) for name in FIELDS})


class Extraction(Strict):
    fields: ExtractedFields
