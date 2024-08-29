const endpoint = "https://beta.pokeapi.co/graphql/v1beta"
const client = graphqlHttp.createClient({url: endpoint});
const getPokemonsListQuery = `
  query getPokemonNamesQuery {
    pokemon_v2_pokemon(where: {pokemon_v2_pokemonforms: {form_name: {_eq: ""}}}) {
      name
    }
  }
`

function getPokemonQuery(name) {
  return `
    query GetPokemonQuery {
      pokemons: pokemon_v2_pokemonspecies(where: {name: {_eq: ${name}}}) {
        forms: pokemon_v2_pokemons(where: {pokemon_v2_pokemonforms: {form_name: {_in: ["", "mega", "mega-y", "mega-x", "attack", "defense", "speed", "alola"]}}}) {
          id
          name
          pokemon_v2_pokemontypes {
            type: pokemon_v2_type {
              name
            }
          }
          pokemon_v2_pokemonabilities {
            ability: pokemon_v2_ability {
              name
              texts: pokemon_v2_abilityeffecttexts(where: {language_id: {_eq: 9}}) {
                effect: effect
              }
            }
          }
          pokemon_v2_pokemonstats {
            value: base_stat
            stat: pokemon_v2_stat {
              name
            }
          }
          pokemon_v2_pokemonsprites {
            sprites # other -> home -> front_default
          }
        }
      }
    }
  `
}

// Load pokemon names as datalist
document.addEventListener("DOMContentLoaded", async function(event) {
  const list = document.getElementById("pokemon-names")
  const result = await new Promise((resolve, reject) => {
    let result;
    cancel = client.subscribe(
      {
        query: getPokemonsListQuery,
      },
      {
        next: (data) => (result = data),
        error: reject,
        complete: () => resolve(result),
      },
    )
  })

  result.data.pokemon_v2_pokemon.forEach(x => {
    let option = document.createElement("option");
    option.value = x.name;
    list.appendChild(option);
  })
})

async function findPokemon() {
  let name = document.getElementById("search-input").value.toLowerCase()
  document.getElementById("result-container").innerHTML = ""
  document.getElementById("search-errors").innerHTML = ""
  const query = getPokemonQuery(name)

  const result = await new Promise((resolve, reject) => {
    let result;
    cancel = client.subscribe(
      {
        query: query,
      },
      {
        next: (data) => (result = data),
        error: (reason) => populateErrors(reason),
        complete: () => resolve(result),
      },
    )
  })

  result.data.pokemons[0].forms.forEach(form => {
    populatePokemon(form)
  })
}

function populateErrors(err) {
  document.getElementById("search-errors").innerHTML = err.message
}

function populatePokemon(pokemon) {
  let container = document.getElementById("result-container")
  let card = document.createElement("pokemon-card")
  card.pokemon = pokemon
  container.appendChild(card)
}

class PokemonCard extends HTMLElement {
  constructor() {
    super()
    this._pokemon = null
  }

  set pokemon(value) {
    this._pokemon = value
  }

  get pokemon() {
    return this._pokemon
  }

  connectedCallback() {
    this.innerHTML = `
      <div class="pokemon-header">
        <p class="pokemon-name">${this.pokemon.name}</p>
      </div>

      <div class="pokemon-data">
        <div>
          <img class="pokemon-image" src=${this.pokemon.pokemon_v2_pokemonsprites[0].sprites.front_default} />
        </div>

        <div class=pokemon-information>
          <div class="pokemon-types">${this.typesAsHtml()}</div>
          <div class="pokemon-abilities">${this.pokemon.pokemon_v2_pokemonabilities.map(x => "<abbr title=\"" + x.ability.texts[0].effect + "\">" + x.ability.name + "</abbr>")}</div>

          <div class="ability-warning">
            * Note that some ability may impact the type effectivness chart *
          </div>
        </div>

        <div class="pokemon-stats">${this.statsAsHtml()}</div>
        <div class="types-stats">${this.typesStatsAsHtml()}</div>
      </div>
    `
  }

  typesAsHtml() {
    return `
      ${this.pokemon.pokemon_v2_pokemontypes.map(x => `<span class="type ${x.type.name}">${x.type.name}</span>`).join(" ")}
    `
  }

  statsAsHtml() {
    return `
      <ul class="stats-list">
        ${this.pokemon.pokemon_v2_pokemonstats.map(x => `<li><span>${x.stat.name}</span>: <span class="stat-value" style="--degree: ${x.value}">${x.value}</span></li>`).join(" ")}
      </ul>
    `
  }

  typesStatsAsHtml() {
    const types = this.pokemon.pokemon_v2_pokemontypes.map(x => { return x.type.name })
    const advantages = calculateTypeAdvantages(types)

    return `
      <ul class="stats-list">
        <li><span>x4</span>: ${advantages[4]?.map(x => `<span class="type ${x}">${x}</span>`).join("") || ""}</li>
        <li><span>x2</span>: ${advantages[2]?.map(x => `<span class="type ${x}">${x}</span>`).join("") || ""}</li>
        <li><span>x1</span>: ${advantages[1]?.map(x => `<span class="type ${x}">${x}</span>`).join("") || ""}</li>
        <li><span>x0.5</span>: ${advantages[0.5]?.map(x => `<span class="type ${x}">${x}</span>`).join("") || ""}</li>
        <li><span>x0.25</span>: ${advantages[0.25]?.map(x => `<span class="type ${x}">${x}</span>`).join("") || ""}</li>
        <li><span>x0</span>: ${advantages[0]?.map(x => `<span class="type ${x}">${x}</span>`).join("") || ""}</li>
      </ul>
    `
  }
}

customElements.define("pokemon-card", PokemonCard);

// Too lazy, all this is from chatgpt, so there is probably some mistakes
// attackType: [defendingType]
const typeChart = {
  normal: { normal: 1, fire: 1, water: 1, electric: 1, grass: 1, ice: 1, fighting: 2, poison: 1, ground: 1, flying: 1, psychic: 1, bug: 1, rock: 0.5, ghost: 0, dragon: 1, dark: 1, steel: 0.5, fairy: 1 },
  fire: { normal: 1, fire: 0.5, water: 0.5, electric: 1, grass: 2, ice: 2, fighting: 1, poison: 1, ground: 1, flying: 1, psychic: 1, bug: 0.5, rock: 2, ghost: 1, dragon: 0.5, dark: 1, steel: 2, fairy: 1 },
  water: { normal: 1, fire: 2, water: 0.5, electric: 1, grass: 0.5, ice: 1, fighting: 1, poison: 1, ground: 2, flying: 1, psychic: 1, bug: 1, rock: 2, ghost: 1, dragon: 0.5, dark: 1, steel: 1, fairy: 1 },
  electric: { normal: 1, fire: 1, water: 2, electric: 0.5, grass: 0.5, ice: 1, fighting: 1, poison: 1, ground: 0, flying: 2, psychic: 1, bug: 1, rock: 1, ghost: 1, dragon: 0.5, dark: 1, steel: 1, fairy: 1 },
  grass: { normal: 1, fire: 0.5, water: 2, electric: 1, grass: 0.5, ice: 1, fighting: 1, poison: 0.5, ground: 2, flying: 0.5, psychic: 1, bug: 0.5, rock: 2, ghost: 1, dragon: 0.5, dark: 1, steel: 0.5, fairy: 1 },
  ice: { normal: 1, fire: 0.5, water: 0.5, electric: 1, grass: 2, ice: 0.5, fighting: 1, poison: 1, ground: 2, flying: 2, psychic: 1, bug: 1, rock: 1, ghost: 1, dragon: 2, dark: 1, steel: 0.5, fairy: 1 },
  fighting: { normal: 2, fire: 1, water: 1, electric: 1, grass: 1, ice: 2, fighting: 1, poison: 0.5, ground: 1, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dragon: 1, dark: 2, steel: 2, fairy: 0.5 },
  poison: { normal: 1, fire: 1, water: 1, electric: 1, grass: 2, ice: 1, fighting: 1, poison: 0.5, ground: 0.5, flying: 1, psychic: 1, bug: 1, rock: 0.5, ghost: 0.5, dragon: 1, dark: 1, steel: 0, fairy: 2 },
  ground: { normal: 1, fire: 2, water: 1, electric: 2, grass: 0.5, ice: 1, fighting: 1, poison: 2, ground: 1, flying: 0, psychic: 1, bug: 0.5, rock: 2, ghost: 1, dragon: 1, dark: 1, steel: 2, fairy: 1 },
  flying: { normal: 1, fire: 1, water: 1, electric: 0.5, grass: 2, ice: 1, fighting: 2, poison: 1, ground: 1, flying: 1, psychic: 1, bug: 2, rock: 0.5, ghost: 1, dragon: 1, dark: 1, steel: 0.5, fairy: 1 },
  psychic: { normal: 1, fire: 1, water: 1, electric: 1, grass: 1, ice: 1, fighting: 0.5, poison: 2, ground: 1, flying: 1, psychic: 0.5, bug: 1, rock: 1, ghost: 1, dragon: 1, dark: 2, steel: 0.5, fairy: 1 },
  bug: { normal: 1, fire: 0.5, water: 1, electric: 1, grass: 2, ice: 1, fighting: 0.5, poison: 0.5, ground: 1, flying: 0.5, psychic: 2, bug: 1, rock: 1, ghost: 0.5, dragon: 1, dark: 2, steel: 0.5, fairy: 0.5 },
  rock: { normal: 1, fire: 2, water: 1, electric: 1, grass: 1, ice: 2, fighting: 0.5, poison: 1, ground: 0.5, flying: 2, psychic: 1, bug: 2, rock: 1, ghost: 1, dragon: 1, dark: 1, steel: 0.5, fairy: 1 },
  ghost: { normal: 0, fire: 1, water: 1, electric: 1, grass: 1, ice: 1, fighting: 0, poison: 0.5, ground: 1, flying: 1, psychic: 2, bug: 0.5, rock: 1, ghost: 2, dragon: 1, dark: 2, steel: 1, fairy: 1 },
  dragon: { normal: 1, fire: 1, water: 1, electric: 1, grass: 1, ice: 1, fighting: 1, poison: 1, ground: 1, flying: 1, psychic: 1, bug: 1, rock: 1, ghost: 1, dragon: 2, dark: 1, steel: 0.5, fairy: 0 },
  dark: { normal: 1, fire: 1, water: 1, electric: 1, grass: 1, ice: 1, fighting: 0.5, poison: 1, ground: 1, flying: 1, psychic: 2, bug: 1, rock: 1, ghost: 2, dragon: 1, dark: 0.5, steel: 1, fairy: 0.5 },
  steel: { normal: 1, fire: 0.5, water: 0.5, electric: 0.5, grass: 1, ice: 2, fighting: 0.5, poison: 1, ground: 0.5, flying: 1, psychic: 1, bug: 1, rock: 2, ghost: 1, dragon: 1, dark: 1, steel: 0.5, fairy: 2 },
  fairy: { normal: 1, fire: 0.5, water: 1, electric: 1, grass: 1, ice: 1, fighting: 2, poison: 0.5, ground: 1, flying: 1, psychic: 1, bug: 1, rock: 1, ghost: 1, dragon: 2, dark: 2, steel: 0.5, fairy: 1 }
};

function calculateTypeAdvantages(defenderTypes) {
  const effectivenessGroups = {};

  for (const attackerType in typeChart) {
    let totalEffectiveness = 1;

    for (const defenderType of defenderTypes) {
      totalEffectiveness *= typeChart[attackerType][defenderType];
    }

    if (!effectivenessGroups[totalEffectiveness]) {
      effectivenessGroups[totalEffectiveness] = [];
    }

    effectivenessGroups[totalEffectiveness].push(attackerType);
  }

  return effectivenessGroups;
}
