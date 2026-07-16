# План реализации connector slots в Yadraw

## 1. Главная идея

В Yadraw карточка должна иметь редактируемые точки подключения по периметру.

Эти точки называем:

```text
Connector Slot
```

Пользователь сам управляет слотами:

```text
добавляет слот
удаляет пустой слот
выбирает тип слота
перемещает слот по периметру карточки
подключает к нему линии
```

Слотов может быть сколько угодно.

Слот может быть пустым или подключённым.

---

## 2. Чем connector slot отличается от старой модели ports

Раньше модель была ближе к такой:

```text
у card type есть semantic port input/output
карточка только показывает эти ports
```

Теперь нужна более гибкая модель:

```text
у конкретной карточки есть набор connector slots
каждый slot сам имеет тип Input / Output / Receiver
```

Пример:

```text
slot-1: Input
slot-2: Input
slot-3: Output
slot-4: Receiver
slot-5: Receiver
```

То есть пользователь не ограничен одним входом и одним выходом. Он может сам настроить столько точек подключения, сколько нужно для конкретной карточки.

---

## 3. Типы connector slots

Нужно поддерживать три типа:

```text
Input
Output
Receiver
```

### Input

Входная точка подключения.

Используется, когда линия приходит в карточку.

Пример:

```text
A.output → B.input
```

Визуально:

```text
пустой кружок
```

---

### Output

Выходная точка подключения.

Используется, когда линия выходит из карточки.

Пример:

```text
A.output → B.input
```

Визуально:

```text
заполненный кружок
```

---

### Receiver

Проходная точка подключения.

Может принимать связь и отдавать связь дальше.

Пример:

```text
A.output → B.receiver → C.input
```

Receiver нужен для проходных карточек, промежуточных узлов, маршрутизации, группировки и схем, где карточка находится “на пути” связи.

Визуально:

```text
кружок с точкой внутри
```

---

## 4. Визуальные правила

Порты/слоты не должны касаться карточки вплотную. Они должны находиться чуть снаружи периметра карточки, как сейчас.

Правило:

```text
slot находится немного снаружи карточки
connection line подходит к slot
slot визуально отделён от карточки
```

Тип слота обозначается только формой:

```text
Input    = пустой кружок
Output   = заполненный кружок
Receiver = кружок с точкой внутри
```

Цвет обозначает состояние:

```text
серый = свободный slot, нет подключения
синий = slot подключён
```

Примеры:

```text
серый пустой кружок = свободный Input
синий пустой кружок = подключённый Input

серый заполненный кружок = свободный Output
синий заполненный кружок = подключённый Output

серый кружок с точкой = свободный Receiver
синий кружок с точкой = подключённый Receiver
```

Цвет не должен обозначать тип слота. Тип обозначается формой.

---

## 5. Что происходит при двойном клике

Двойной клик по карточке включает visual edit mode.

В visual edit mode пользователь может редактировать connector slots:

```text
добавить новый slot
выбрать тип slot: Input / Output / Receiver
переместить slot по периметру карточки
удалить пустой slot
переименовать label slot, если нужно
```

Система не должна заранее создавать фиксированные 3–4 слота.

Правильная логика:

```text
пользователь сам добавляет столько slots, сколько ему нужно
```

Например:

```text
карточка сначала имеет 1 Output
пользователь double-click
добавляет ещё 2 Input
добавляет 1 Receiver
перемещает их по периметру
сохраняет карточку
```

---

## 6. Модель connector slot

У каждого слота должны быть свойства:

```text
id
type
side
offset
label
```

Где:

```text
id = уникальный id слота внутри карточки
type = input | output | receiver
side = top | right | bottom | left
offset = положение на стороне от 0 до 1
label = человекочитаемое имя, например Input, Output, Receiver, Payload
```

Пример:

```json
{
  "id": "slot-1",
  "type": "input",
  "side": "left",
  "offset": 0.5,
  "label": "Input"
}
```

Пример нескольких слотов:

```json
[
  {
    "id": "slot-1",
    "type": "input",
    "side": "left",
    "offset": 0.25,
    "label": "Input"
  },
  {
    "id": "slot-2",
    "type": "input",
    "side": "left",
    "offset": 0.75,
    "label": "Input"
  },
  {
    "id": "slot-3",
    "type": "output",
    "side": "right",
    "offset": 0.5,
    "label": "Output"
  },
  {
    "id": "slot-4",
    "type": "receiver",
    "side": "bottom",
    "offset": 0.5,
    "label": "Receiver"
  }
]
```

---

## 7. Где хранить connector slots

Connector slots относятся к конкретной карточке.

Это не `card.data`.

`card.data` остаётся только для пользовательских/business JSON-данных.

На первом этапе slots можно хранить в `visualStyle`, потому что они связаны с визуальной раскладкой карточки:

```json
{
  "connectorSlots": [
    {
      "id": "slot-1",
      "type": "input",
      "side": "left",
      "offset": 0.5,
      "label": "Input"
    },
    {
      "id": "slot-2",
      "type": "output",
      "side": "right",
      "offset": 0.5,
      "label": "Output"
    }
  ]
}
```

Но нужно понимать: slot имеет не только визуальный смысл, но и тип подключения.

Поэтому в будущем лучше вынести slots в отдельную структуру, например:

```text
cards.connector_slots
```

или отдельную таблицу:

```text
card_connector_slots
```

Для MVP можно начать с:

```text
visualStyle.connectorSlots
```

Но строго запрещено класть slots в:

```text
card.data
```

---

## 8. Как connection должна ссылаться на slot

Идеальная модель:

```text
connection.source_slot_id
connection.target_slot_id
```

Пример:

```json
{
  "source_card_id": "card-a",
  "source_slot_id": "slot-output-1",
  "target_card_id": "card-b",
  "target_slot_id": "slot-input-2"
}
```

Так связь точно знает, из какого slot вышла и в какой slot пришла.

---

## 9. Как быть с текущими source_port_key / target_port_key

Сейчас в V2 уже есть модель connections через:

```text
source_port_key
target_port_key
```

Чтобы не ломать всё сразу, можно сделать промежуточный вариант:

```text
slot.id используется как port_key
```

Например:

```text
source_port_key = "slot-output-1"
target_port_key = "slot-input-2"
```

Но это временный компромисс.

Более чистый вариант для будущего:

```text
source_port_key / target_port_key = semantic compatibility
source_slot_id / target_slot_id = visual endpoint
```

Для ближайшей реализации нужно выбрать аккуратный путь.

### MVP-вариант

Использовать slot id как key подключения.

Плюсы:

```text
быстрее
меньше DB/API изменений
React Flow handle id проще связать со slot id
```

Минусы:

```text
slot становится не только визуальным, но и semantic endpoint
сложнее отделить card type ports от card instance slots
```

### Правильный будущий вариант

Добавить отдельные поля:

```text
source_slot_id
target_slot_id
```

Плюсы:

```text
чистая архитектура
можно отдельно хранить semantic port и visual slot
```

Минусы:

```text
потребуется migration/API/repository update
```

---

## 10. Правила соединения slots

На уровне UI и backend нужно соблюдать правила:

```text
Output   → Input      allowed
Output   → Receiver   allowed
Receiver → Input      allowed
Receiver → Receiver   allowed
Input    → Output     denied
Input    → Input      denied
Output   → Output     denied
```

То есть:

```text
Input принимает
Output отдаёт
Receiver может быть и принимающим, и отдающим
```

Receiver работает как проходная точка.

Пример:

```text
A Output → B Receiver
B Receiver → C Input
```

---

## 11. Поведение Receiver

Receiver нужен, чтобы карточка могла быть промежуточной в цепочке.

Пример:

```text
Source → Processor → Result
```

Если `Processor` имеет Receiver, пользователь может сделать:

```text
Source.output → Processor.receiver
Processor.receiver → Result.input
```

Визуально это выглядит как прохождение связи через карточку.

Важно: на первом этапе Receiver не обязан автоматически “прокидывать данные”. Он должен просто позволять такую структуру связей.

Позже, когда появятся workflow/execution semantics, Receiver можно будет сделать полноценным проходным узлом данных.

---

## 12. Добавление slots в visual edit mode

В visual edit mode должна быть секция или мини-панель:

```text
Connector slots
```

Возможные действия:

```text
+ Input
+ Output
+ Receiver
```

При нажатии:

```text
+ Input
```

создаётся новый свободный input slot.

При нажатии:

```text
+ Output
```

создаётся новый свободный output slot.

При нажатии:

```text
+ Receiver
```

создаётся новый свободный receiver slot.

Новый slot появляется на свободной стороне карточки или рядом с похожими slots.

Потом пользователь может перетащить его по периметру.

---

## 13. Удаление slots

Удалять можно только пустой slot.

Правило:

```text
если slot подключён — удалить нельзя
```

UI должен показать понятное сообщение:

```text
Disconnect this slot before deleting it.
```

Для MVP не нужно делать автоматическое удаление связей вместе со slot.

Безопасный вариант:

```text
сначала пользователь удаляет connection
потом удаляет slot
```

---

## 14. Перемещение slots

В visual edit mode пользователь может перетаскивать slot по периметру карточки.

Слот должен “прилипать” к ближайшей стороне:

```text
top
right
bottom
left
```

После drag нужно пересчитать:

```text
side
offset
```

Пример:

```json
{
  "id": "slot-3",
  "type": "output",
  "side": "right",
  "offset": 0.62
}
```

После сохранения и reload слот должен остаться на том же месте.

---

## 15. Состояние connected / free

Слот считается connected, если есть active connection, где он используется.

Например:

```text
source_slot_id = slot.id
```

или во временной модели:

```text
source_port_key = slot.id
```

Состояние влияет только на цвет:

```text
free      = grey
connected = blue
```

Тип слота всё равно определяется формой.

---

## 16. Что делать с существующими карточками

У существующих карточек уже могут быть старые ports.

Нужно сделать fallback:

```text
если connectorSlots есть → использовать их
если connectorSlots нет → построить default slots из существующих ports
```

Например:

```text
старый input port → один Input slot слева
старый output port → один Output slot справа
старый receiver port → один Receiver slot снизу или справа
```

Так старые карточки не сломаются.

После первого сохранения visual edit mode можно записать slots в `visualStyle.connectorSlots`.

---

## 17. Что делать с существующими connections

Существующие connections используют:

```text
source_port_key
target_port_key
```

Для них нужен fallback mapping:

```text
если connection указывает на старый port key
найти default slot для этого port key
отрисовать линию к нему
```

В будущем можно мигрировать connections на slot-aware модель.

Но в MVP нельзя ломать существующие connections.

---

## 18. Что можно делать сейчас

В ближайшем цикле можно реализовать:

```text
1. визуальные формы Input / Output / Receiver
2. grey/blue state для free/connected
3. Edit по двойному клику показывает connector slot controls
4. добавление slot нужного типа
5. удаление пустого slot
6. перемещение slot по периметру
7. сохранение slots в visualStyle.connectorSlots
8. fallback для старых ports/cards
```

---

## 19. Что не делать сейчас

Пока не нужно делать:

```text
полный card type port editor
сложные compatibility rules
dataType editor
автоматическое удаление связей при удалении slot
workflow execution через Receiver
массовое изменение slots
миграцию всех старых connections на source_slot_id / target_slot_id
```

Это отдельные этапы.

---

## 20. Поэтапный план реализации

### Этап 1 — визуальная система слотов

Цель:

```text
показать Input / Output / Receiver разными формами
```

Сделать:

```text
Input = пустой кружок
Output = заполненный кружок
Receiver = кружок с точкой внутри
free = grey
connected = blue
slot немного отступает от карточки
```

Без изменения backend.

---

### Этап 2 — fallback connectorSlots для существующих карточек

Цель:

```text
не сломать текущие карточки и connections
```

Сделать:

```text
если visualStyle.connectorSlots отсутствует,
создать virtual slots из существующих ports
```

Пример:

```text
input port → Input slot слева
output port → Output slot справа
receiver port → Receiver slot снизу/справа
```

---

### Этап 3 — visual edit controls для slots

Цель:

```text
в double-click режиме дать управлять slots
```

Сделать UI:

```text
Connector slots
+ Input
+ Output
+ Receiver
```

При добавлении новый slot появляется на периметре карточки.

---

### Этап 4 — сохранение slots в visualStyle

Цель:

```text
сохранять slots после reload
```

Сделать:

```text
добавить connectorSlots в visualStyle
использовать существующий update visualStyle API
не менять card.data
```

---

### Этап 5 — перемещение slots по периметру

Цель:

```text
дать пользователю самому располагать точки подключения
```

Сделать:

```text
drag slot в visual edit mode
snap to nearest side
calculate side + offset
save in visualStyle.connectorSlots
```

---

### Этап 6 — удаление пустых slots

Цель:

```text
дать пользователю убирать лишние точки
```

Сделать:

```text
delete only free slot
deny deleting connected slot
show inline message if slot is connected
```

---

### Этап 7 — подключение линий к user-created slots

Цель:

```text
новые slots должны реально участвовать в connections
```

Сделать:

```text
React Flow handles use slot.id
create connection resolves slot type
validate Output/Receiver as source
validate Input/Receiver as target
save connection using current compatible model
```

---

### Этап 8 — Receiver behavior

Цель:

```text
Receiver может быть проходной точкой
```

Сделать:

```text
receiver can be source
receiver can be target
A.output → B.receiver allowed
B.receiver → C.input allowed
receiver → receiver allowed
```

---

### Этап 9 — slot-aware persistence for connections

Цель:

```text
connection должна помнить конкретный slot
```

Возможная реализация:

```text
source_slot_id
target_slot_id
```

или временно:

```text
source_port_key = slot.id
target_port_key = slot.id
```

Это лучше делать отдельным PR, потому что может потребовать DB/API изменение.

---

## 21. MVP-версия

MVP должен дать пользователю:

```text
double-click card
add Input slot
add Output slot
add Receiver slot
move slots around card
connect lines to slots
see grey free slots
see blue connected slots
delete free slots
reload and keep slots
```

MVP не обязан:

```text
мигрировать все старые connections
иметь сложный port schema editor
запускать workflow через Receiver
автоматически удалять connections при удалении slot
```

---

## 22. Ключевой вывод

Правильная новая модель:

```text
Connector Slot = редактируемая точка подключения на конкретной карточке
```

Слот имеет:

```text
тип: Input / Output / Receiver
форму
позицию на периметре
состояние free/connected
```

Пользователь сам решает:

```text
сколько slots нужно карточке
какого они типа
где они расположены
```

Это именно то, что нужно для визуального редактора Yadraw: карточка остаётся JSON-сущностью, но её точки подключения можно настраивать свободно и наглядно.
