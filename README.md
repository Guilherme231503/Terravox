# Terravox

Clone de Minecraft em C++20 + Vulkan, feito com a engine própria **VAGE (Vexil Advanced Game Engine)**.

## Compilar (MSYS2 UCRT64)

```sh
pacman -S mingw-w64-ucrt-x86_64-gcc mingw-w64-ucrt-x86_64-glfw mingw-w64-ucrt-x86_64-glm \
          mingw-w64-ucrt-x86_64-vulkan-headers mingw-w64-ucrt-x86_64-vulkan-loader \
          mingw-w64-ucrt-x86_64-shaderc mingw-w64-ucrt-x86_64-vulkan-validation-layers \
          mingw-w64-ucrt-x86_64-stb

mingw32-make            # release -> build/release/Terravox.exe
mingw32-make DEBUG=1    # debug + camada de validação do Vulkan
mingw32-make run        # compila e roda
mingw32-make dist       # dist/Terravox.exe (único arquivo para distribuir)
mingw32-make web        # site em web/ (copia o .exe e embute texturas/shaders nos geradores)
mingw32-make assets     # regera os placeholders de assets/
```

Funciona no terminal do MSYS2, no cmd ou no PowerShell (basta `C:\msys64\ucrt64\bin` e o `python` no PATH):
as operações de arquivo do Makefile usam `tools/fs.py` em vez de comandos Unix.

## Tudo dentro do .exe

`tools/pack_assets.py` empacota `assets/` em `build/assets.pak`, que é embutido no executável
(`game/EmbeddedAssets.S`). O `.exe` é estático e só depende do Windows e do `vulkan-1.dll` do driver.

Os dados do jogador ficam **ao lado do .exe**, em `net/vexill/vage/terravox/`:

```
net/vexill/vage/terravox/
  worlds/         mundos (cada um com level.dat, icon.png, chunks/, DIM-1/ Nether, DIM1/ End)
  resourcepacks/  pacotes de recursos (texturas/sons)
  shaders/        shader packs (o pack de exemplo "Cores-Vivas" é extraído na 1ª execução)
  screenshots/    capturas (F2)
  options.txt     configurações          latest.log  log (versão release)
```

## Resource packs e shader packs

- `assets/` contém **apenas placeholders** gerados por `tools/gen_placeholders.py`.
- Os caminhos seguem o Minecraft (`textures/block/stone.png`, `textures/item/diamond_pickaxe.png`,
  `textures/entity/pig/pig.png`, `textures/models/armor/iron_layer_1.png`, `textures/particle/flame.png`,
  `textures/gui/sprites/hud/food_full.png`, `sounds/dig/stone1.ogg`...), então texturas e sons reais funcionam direto.
  Os modelos usam o layout UV do Minecraft (exceto o dragão, que tem layout próprio — veja `EntityModels.cpp`).
- **Resource packs**: pasta (ou subpasta `assets/`) em `resourcepacks/<nome>/` com só os arquivos a trocar.
  Ative em *Opções > Pacotes de Recursos* (a ordem define a prioridade).
- **Shader packs** (aba separada, *Opções > Shaders*): pasta em `shaders/<nome>/` com qualquer um de
  `terrain.vert`, `block.frag`, `entity.vert`, `sky.vert`, `sky.frag`, `ui.vert`, `ui.frag` (GLSL, compilado em
  tempo de execução) e um `pack.txt` com a descrição. Se não compilar, o shader embutido é usado e o erro aparece
  na tela/log.
- Texturas: PNG/JPG/TGA, qualquer resolução; tiras verticais = animação (água, lava, magma, portal).
  Grama, folhas e água usam texturas em tons de cinza tingidas como no Minecraft.
- Sons: `.ogg` ou `.wav`, variantes numeradas (`stone1`, `stone2`...) escolhidas aleatoriamente.

## Recursos

- **Mundos**: infinitos com seed; tipos Padrão, Superplano (com predefinições), Biomas Grandes e Amplificado.
  20 biomas (planície, florestas, floresta escura, selva, savana, deserto, badlands, pântano, taigas,
  planície nevada, montanhas, campos de cogumelos, oceanos, rios...), cavernas, minérios (carvão, ferro, cobre,
  ouro, redstone, lápis, diamante, esmeralda), 6 tipos de árvore, fortalezas com portal do End.
- **Nether** (portal de obsidiana aceso com isqueiro, escala 1:8, netherrack, quartzo, ouro, soul sand, magma,
  pedra luminosa, ghasts, blazes, piglins zumbis) e **The End** (ilha, pilares com cristais, dragão do Ender,
  portal de saída e ovo do dragão).
- **Sobrevivência**: vida, fome e saturação (regeneração/inanição), afogamento com bolhas, natação,
  dano de queda/lava/fogo, armaduras (couro, ferro, ouro, diamante), escadas de mão, camas, cultivo de trigo.
  **Criativo**: voo, abas como no original (Construção, Coloridos, Naturais, Funcionais, Ferramentas, Combate,
  Comida, Ingredientes, Ovos Geradores, Busca e Inventário de Sobrevivência). **Espectador** e **Hardcore**.
- Blocos novos: granito/diorito/andesito, tijolos variados, lajes, escadas, cercas, portas, vidro e lã de 16 cores,
  concreto, terracota, abóboras, melancias, feno, cana, cogumelos, teia, lanterna e mais.
- Mobs: porco, vaca, ovelha (tosquia), galinha (ovos), lobo (domesticável), lula, zumbi, esqueleto (arco),
  aranha, creeper, enderman, piglin zumbi, ghast, blaze, dragão; procriação e filhotes; arco e flechas.
- Animações: andar, balançar o braço, item na mão, comer, mobs, asas, partículas (blocos, fumaça, explosões,
  chamas, corações, críticos, bolhas, portal) e itens voando até o jogador ao coletar.
- **Terceira pessoa** (F5, atrás e de frente), com armadura no modelo.
- Itens como no original: blocos com modelo 3D no inventário, na mão e no chão (cubos, lajes, escadas, cercas,
  lanterna, moldura do portal do End, cama inteira); itens planos extrudados com 1 pixel de espessura na mão e no chão; portas
  com textura de item própria (`textures/item/oak_door.png`).
- **Panorama no menu**: um mundo gerado só em memória (nada é salvo) gira atrás do título e dos menus, como no
  Minecraft; muda a cada execução (`TERRAVOX_PANORAMA_SEED=<n>` fixa a seed).
- Menus: título, seleção de mundos com capas (gerada ao "Salvar e Sair"), busca, editar/excluir/recriar,
  criação de mundo com abas (Jogo/Mundo/Mais), pausa, estatísticas, morte, chat, F3.
- Mouse: cursor próprio, travamento melhor (descarta o salto ao travar, entrada "raw"), pausa ao perder o foco.
- Configurações de vídeo/renderizador, som por categoria, controles, partículas, packs.

## Site (web/)

`web/index.html` apresenta o jogo e tem o botão de download (`web/downloads/Terravox.exe`). Também traz dois
geradores para criadores, que funcionam abertos direto do disco ou hospedados em qualquer servidor estático:

- `web/shaders.html`: **gerador de shader packs** (cor, contraste, saturação, temperatura, P&B/sépia, posterização,
  neblina, vento e ondas), com prévia antes/depois e zip pronto (`block.frag`, `sky.frag`, `terrain.vert`, `pack.txt`).
  O código gerado envolve o shader original do jogo (`#define main terravoxBaseMain`) e aplica os ajustes no fim.
- `web/resourcepacks.html`: **gerador de resource packs** com todas as texturas do jogo, filtros em lote, editor de
  pixels (lápis, borracha, balde, conta-gotas, desfazer, 2×, enviar PNG) e exemplos prontos. O zip leva só o que mudou.

`mingw32-make web` (ou `python tools/build_web.py`) atualiza `web/data/` e a cópia do executável.

## Controles

| Tecla | Ação |
|---|---|
| WASD / Mouse | mover / olhar |
| Espaço | pular, nadar (2x no criativo = voar) |
| Shift / Ctrl | agachar / correr |
| Botão esquerdo | quebrar / atacar |
| Botão direito | usar (blocos, portas, camas, comer, arco, baldes, ovos, armaduras), colocar |
| Botão do meio | pegar bloco |
| 1-9 / roda | hotbar (1-9 sobre um slot no inventário troca com a hotbar) |
| E | inventário (criativo: abas) |
| Q | soltar item (Ctrl = pilha) |
| T ou / | chat (Tab completa comandos, itens e mobs; setas escolhem a sugestão) |
| F1 / F2 / F3 / F5 | esconder HUD / captura de tela / depuração / câmera |
| ESC | pausa |

Comandos: `/help`, `/gamemode`, `/difficulty`, `/gamerule`, `/tp`, `/time set`, `/give`, `/items`,
`/summon`, `/kill`, `/heal`, `/feed`, `/seed`, `/clear`, `/spawnpoint`, `/locate`, `/dimension`, `/debug`.

## Testes automatizados (variáveis de ambiente)

`TERRAVOX_AUTOWORLD=<nome>` abre/cria um mundo, `TERRAVOX_WORLDTYPE=flat`, `TERRAVOX_AUTOCMD="/cmd;/cmd"`,
`TERRAVOX_AUTOSCREEN=worlds|options|resourcepacks|shaders`, `TERRAVOX_CAMERA=1|2|3` (3 = lateral), `TERRAVOX_TESTARMOR=1`, `TERRAVOX_TESTSNEAK=1`,
`TERRAVOX_AUTOQUIT=<segundos>`, `TERRAVOX_PANORAMA_SEED=<n>`, `TERRAVOX_ASSETS_DIR=<pasta>` (assets soltos em vez dos embutidos) e
`VAGE_IGNORE_INPUT=1` (a janela não rouba o foco nem lê teclado/mouse reais).

## Estrutura

```
vage/   Engine: Window, VulkanDevice, Swapchain, Renderer, Buffer, Texture, Pipeline, ShaderCompiler,
        Assets (pak embutido + resource/shader packs), Audio, Font, SpriteBatch, JobSystem, Noise, Camera
game/   Blocks, Items, Crafting, Shapes, Chunk, WorldGen, Mesher, World, Entity, Mobs, Projectiles, Player,
        Sounds, Settings, Resources, EntityModels, WorldRenderer, Gui, Screens, ContainerScreens, Panorama, Game, App
assets/ placeholders + shaders + examples/     tools/ gen_placeholders.py, pack_assets.py, build_web.py, fs.py
web/    site: index.html, shaders.html, resourcepacks.html, css/, js/, img/, data/ (gerado), downloads/ (gerado)
```
