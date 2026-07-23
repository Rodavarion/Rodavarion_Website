PRAGMA foreign_keys = ON;

INSERT INTO legal_concepts
(id, jurisdiction, slug, canonical_label, description, concept_kind, status)
VALUES
('ua-concept-right-to-life','UA','right-to-life','Право на життя',
 'Конституційне право людини на життя та його державний захист.','right','active'),
('ua-concept-intentional-killing','UA','intentional-killing','Умисне вбивство',
 'Умисне протиправне позбавлення життя іншої людини.','offence','active'),
('ua-concept-human-dignity','UA','human-dignity','Людська гідність',
 'Недоторканність гідності людини та заборона принизливого поводження.','principle','active'),
('ua-concept-property-right','UA','property-right','Право власності',
 'Право володіти, користуватися та розпоряджатися майном.','right','active')
ON CONFLICT(id) DO UPDATE SET
    canonical_label=excluded.canonical_label,
    description=excluded.description,
    concept_kind=excluded.concept_kind,
    status=excluded.status,
    updated_at=CURRENT_TIMESTAMP;

INSERT INTO legal_concept_aliases
(id, concept_id, alias, normalized_alias, alias_kind, weight)
VALUES
('alias-life-01','ua-concept-right-to-life','право на життя','право на життя','phrase',1.0),
('alias-life-02','ua-concept-right-to-life','життя','життя','term',0.72),
('alias-kill-01','ua-concept-intentional-killing','умисне вбивство','умисне вбивство','phrase',1.0),
('alias-kill-02','ua-concept-intentional-killing','вбивство','вбивство','term',0.95),
('alias-kill-03','ua-concept-intentional-killing','вбивства','вбивства','term',0.86),
('alias-kill-04','ua-concept-intentional-killing','позбавлення життя','позбавлення життя','phrase',0.90),
('alias-dignity-01','ua-concept-human-dignity','людська гідність','людська гідність','phrase',1.0),
('alias-dignity-02','ua-concept-human-dignity','гідність','гідність','term',0.92),
('alias-property-01','ua-concept-property-right','право власності','право власності','phrase',1.0),
('alias-property-02','ua-concept-property-right','власність','власність','term',0.90),
('alias-property-03','ua-concept-property-right','майно','майно','term',0.72)
ON CONFLICT(concept_id, normalized_alias) DO UPDATE SET
    alias=excluded.alias,
    alias_kind=excluded.alias_kind,
    weight=excluded.weight;

INSERT INTO legal_concept_unit_links
(id, concept_id, unit_id, relation_type, confidence, origin, review_status, note)
SELECT
    'link-life-constitution-27',
    'ua-concept-right-to-life',
    id,
    'protects',
    1.0,
    'editorial',
    'reviewed',
    'Стаття 27 Конституції України прямо закріплює невід’ємне право на життя.'
FROM legal_units
WHERE act_id='ua-constitution-254k-96-vr'
  AND unit_type='article'
  AND unit_number='27'
LIMIT 1
ON CONFLICT(concept_id, unit_id, relation_type) DO UPDATE SET
    confidence=excluded.confidence,
    review_status=excluded.review_status,
    note=excluded.note,
    updated_at=CURRENT_TIMESTAMP;

INSERT INTO legal_concept_unit_links
(id, concept_id, unit_id, relation_type, confidence, origin, review_status, note)
SELECT
    'link-killing-constitution-27',
    'ua-concept-intentional-killing',
    id,
    'related',
    0.94,
    'editorial',
    'reviewed',
    'Конституційний зв’язок через заборону свавільного позбавлення життя.'
FROM legal_units
WHERE act_id='ua-constitution-254k-96-vr'
  AND unit_type='article'
  AND unit_number='27'
LIMIT 1
ON CONFLICT(concept_id, unit_id, relation_type) DO UPDATE SET
    confidence=excluded.confidence,
    review_status=excluded.review_status,
    note=excluded.note,
    updated_at=CURRENT_TIMESTAMP;

INSERT INTO legal_concept_unit_links
(id, concept_id, unit_id, relation_type, confidence, origin, review_status, note)
SELECT
    'link-dignity-constitution-28',
    'ua-concept-human-dignity',
    id,
    'protects',
    1.0,
    'editorial',
    'reviewed',
    'Стаття 28 Конституції України охороняє гідність людини.'
FROM legal_units
WHERE act_id='ua-constitution-254k-96-vr'
  AND unit_type='article'
  AND unit_number='28'
LIMIT 1
ON CONFLICT(concept_id, unit_id, relation_type) DO UPDATE SET
    confidence=excluded.confidence,
    review_status=excluded.review_status,
    note=excluded.note,
    updated_at=CURRENT_TIMESTAMP;

INSERT INTO legal_concept_unit_links
(id, concept_id, unit_id, relation_type, confidence, origin, review_status, note)
SELECT
    'link-property-constitution-41',
    'ua-concept-property-right',
    id,
    'protects',
    1.0,
    'editorial',
    'reviewed',
    'Стаття 41 Конституції України закріплює право приватної власності.'
FROM legal_units
WHERE act_id='ua-constitution-254k-96-vr'
  AND unit_type='article'
  AND unit_number='41'
LIMIT 1
ON CONFLICT(concept_id, unit_id, relation_type) DO UPDATE SET
    confidence=excluded.confidence,
    review_status=excluded.review_status,
    note=excluded.note,
    updated_at=CURRENT_TIMESTAMP;

INSERT INTO legal_concept_relations
(id, source_concept_id, target_concept_id, relation_type, confidence, origin, review_status, note)
VALUES
('relation-killing-life',
 'ua-concept-intentional-killing',
 'ua-concept-right-to-life',
 'references',
 1.0,
 'editorial',
 'reviewed',
 'Поняття умисного вбивства безпосередньо пов’язане з охороною права на життя.')
ON CONFLICT(source_concept_id, target_concept_id, relation_type) DO UPDATE SET
    confidence=excluded.confidence,
    review_status=excluded.review_status,
    note=excluded.note,
    updated_at=CURRENT_TIMESTAMP;
