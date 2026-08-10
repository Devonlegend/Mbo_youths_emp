Eligibility Criteria — Frontend Implementation

Feature: Expose scheme eligibility criteria (previously backend-only) through the admin frontend. Status: Complete, pending live test + backend confirmation. Date: August 2026

What changed

Admins can now set and edit eligibility criteria for a scheme directly from the frontend, instead of the values only being settable via raw JSON on the backend (Django admin / API tooling).

No backend changes were required. ScholarshipSchemeSerializer.create()/update() already reads these values as flat top-level keys straight off request.data and assembles eligibility_criteria server-side — the frontend just needed to send the right keys in the same JSON body it already sends for name, award_amount, etc.

Fields per category
Category	Fields
Scholarship	min_cgpa, allowed_levels, ward_restriction, max_prior_awards
Empowerment	min_age, max_age, allowed_trades, ward_restriction, max_prior_awards
Grant	min_age, max_age, ward_restriction, max_prior_awards (same as Empowerment minus trades)
List-type fields (allowed_levels, allowed_trades, ward_restriction) are entered as comma-separated text in the UI (e.g. 200, 300, 400) and split into arrays server-side.
All fields are optional. Leaving a field blank means "no restriction on that criterion" — confirmed the backend eligibility engine treats missing/blank keys as a pass, not a failure (see "Backend verification" below).

