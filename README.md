# BuBu Autoškola Onboarding

Prvý funkčný MVP prototyp objednávkového a onboardingového systému pre autoškolu BuBu.

## Čo je hotové

- verejná objednávka kurzu,
- automatické vytvorenie ticketu v backoffice,
- demo prihlasovacie údaje študenta po objednávke,
- admin login a zoznam prihlášok,
- farebné stavy prihlášky:
  - modrá: nová,
  - oranžová: zadané údaje študentom,
  - zelená: schválená a pripravená na import,
  - sivá: vyriešená a mimo XML exportu,
- študentský onboarding s časovou osou,
- formulár podľa časti `VYPLŇUJE ŽADATEL` z priloženej žiadosti,
- nahrávanie metadát dokumentov,
- povinnosť zadnej strany vodičského preukazu pri existujúcej skupine,
- tlačiteľný náhľad vyplnenej prihlášky,
- dvojstranová prihláška modelovaná podľa dodaného PDF tlačiva,
- pripomienky cez textové okno,
- potvrdenie pred označením prihlášky ako vyriešenej,
- uloženie prihlasovacích údajov z Mojej autoškoly do profilu študenta,
- XML export schválených prihlášok.

## Spustenie

Otvorte `index.html` v prehliadači alebo spustite jednoduchý lokálny server.

Demo účty:

- admin: `admin@bubu.sk` / `bubuadmin`
- študent: `martin.novak@example.com` / `BUBU-001`

## Poznámka

Tento prototyp je bez backendu a databázy. Dáta sa ukladajú do `localStorage`, takže je vhodný na UX a procesné overenie. Produkčná verzia by mala doplniť server, databázu, e-mailové odosielanie, autentifikáciu, bezpečné úložisko dokumentov a presné generovanie PDF z oficiálnej predlohy.
