# Banc d'essai

Mesure les modèles Antigravity du compte actif, appelés exactement comme le plugin les appelle.

```bash
npm run bench            # toutes les configurations offertes au compte
npm run bench -- --only 'gemini-3.8-flash high|claude-sonnet-4.6'
npm run bench:check      # vérifie les tests difficiles avec les solutions de référence
```

- **code** (12) et **hard** (7) : une fonction JavaScript à écrire, jugée par des tests cachés. Le code tourne dans un
  processus Node restreint (`--permission` : lecture de son seul fichier, ni écriture ni processus enfant), avec une limite de temps.
- **reasoning** (8) : une réponse exacte.
- Les détails de chaque essai (réponses fausses, temps, jetons) sont écrits dans `bench/results/`.

## Ce que la mesure a montré (novembre 2026, Gemini 3.8 Flash)

| Gemini 3.8 Flash High | code | hard | reasoning | temps moyen | jetons de réflexion |
|---|---|---|---|---|---|
| tel qu'Antigravity l'envoie | 12/12 | 7/7 | 8/8 | 23 s | 2 845 |
| budget de réflexion illimité forcé | 12/12 | 7/7 | 8/8 | 66 s | 8 882 |
| + prompt système « ingénieur senior » | 12/12 | 5/7 | 8/8 | 114 s | 16 066 |

Sur des problèmes bornés, Flash High résout tout ; le forcer à réfléchir plus le ralentit sans gain, et un prompt
d'ingénieur le fait trop réfléchir jusqu'à l'échec. Le plugin garde donc High tel qu'Antigravity l'envoie et n'applique
que les plafonds de Medium et Low, qui sinon ne sont pas respectés.
