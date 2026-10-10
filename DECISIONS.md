# Decisions

This file is the record of decisions made while building the site: every default of SPEC.md section 10 that was relied on (one line per default, with the date and the reason, as SPEC.md 9.3 asks), every dependency added to the site (version, licence, and size when it is shipped to the reader), every [U] or [D] item a builder had to settle, and every deviation a builder reported.

Entries are appended by the MERGE and GATE agents from the fragments in `decisions/*.md`, one fragment per agent id, in the form of `build-plan/COMMON.md` section 5.1. No build agent edits this file directly: a build agent writes its fragment and MERGE or GATE copies it here verbatim under a dated stage heading. The owner's part of each gate (SPEC.md 9.1) is recorded here as due when the gate's automatic part has passed and the red team is dry.
