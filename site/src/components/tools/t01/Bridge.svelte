<script lang="ts">
  // The line a = Cp between the two boards of the linked view, and the bridge sentence of SPEC.md
  // 2.4(a), verbatim: "The number on node i is the amount by which a mutation would lower city i."
  // ("must appear, with the same wording, wherever the two views are shown together" [D]). The line
  // is MathML (A-12; no typesetting library at runtime, 7.6), with an aria-label as the fallback of
  // SPEC 7.3's [U] item on MathML in every engine. D7: a = Cp, the drop; never the gain -Cp.
</script>

<div class="bridge">
  <p class="line" data-out="aCp">
    <math display="inline" aria-label="a equals C p"><mi>a</mi><mo>=</mo><mi>C</mi><mi>p</mi></math>
  </p>
  <p class="sentence" data-out="bridgeSentence">The number on node <i>i</i> is the amount by which a mutation would lower city <i>i</i>.</p>
</div>

<style>
  .bridge {
    display: grid;
    gap: 4px;
    justify-items: center;
    text-align: center;
    padding: 4px 8px;
  }
  .line,
  .sentence {
    margin: 0;
  }
  .line {
    font-size: 1.15em;
    min-height: 1.6em;
  }
</style>
