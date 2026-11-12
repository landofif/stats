import QtCore
import QtQuick
import QtQuick.Controls.Basic

// Top artists, tracks and albums for a period, from the stored history.
Item {
    id: view
    property string type: "artists"
    property string path: ""
    property string message: ""
    property int max: 1

    Settings {
        category: "top"
        property alias type: view.type
        property alias period: periods.period
        property alias from: periods.fromText
        property alias to: periods.toText
    }

    function reload() {
        const r = periods.range
        if (!r) {
            items.clear()
            view.path = ""
            view.message = "Type a start and an end date, like 2026-01-31."
            return
        }
        const path = "/top?type=" + view.type + "&limit=100&" + Api.query(r)
        if (path !== view.path) {
            items.clear()
            view.message = "Loading…"
        }
        view.path = path
        Api.load(path, function (data, error) {
            if (path !== view.path)
                return // an answer for a selection that has since changed
            items.clear()
            if (!data) {
                view.message = "Could not load: " + error
                return
            }
            view.message = data.items.length ? "" : "Nothing in this period."
            view.max = data.items.length ? data.items[0].plays : 1
            data.items.forEach(function (item, i) {
                items.append({
                    rank: i + 1,
                    name: item.track || item.album || item.artist,
                    sub: view.type === "artists" ? "" : item.artist,
                    plays: item.plays,
                    image: item.image
                })
            })
        })
    }
    onTypeChanged: reload()
    onVisibleChanged: if (visible) reload()
    Component.onCompleted: reload()

    ListModel { id: items }

    Column {
        id: controls
        width: parent.width
        spacing: 10

        Row {
            spacing: 6
            Repeater {
                model: [["artists", "Artists"], ["tracks", "Tracks"], ["albums", "Albums"]]
                Chip {
                    required property var modelData
                    text: modelData[1]
                    selected: view.type === modelData[0]
                    tint: Theme.blue
                    onClicked: view.type = modelData[0]
                }
            }
        }
        PeriodBar {
            id: periods
            width: parent.width
            onRangeChanged: view.reload()
        }
    }

    Text {
        anchors.centerIn: list
        visible: view.message !== ""
        text: view.message
        color: Theme.muted
    }

    ListView {
        id: list
        anchors { top: controls.bottom; topMargin: 14; left: parent.left; right: parent.right; bottom: parent.bottom }
        clip: true
        model: items
        boundsBehavior: Flickable.StopAtBounds
        ScrollBar.vertical: ScrollBar {}

        spacing: 4

        // Number one is a hero card; two and three get a blue badge.
        delegate: Rectangle {
            id: row
            required property int rank
            required property string name
            required property string sub
            required property int plays
            required property string image
            readonly property bool hero: rank === 1
            readonly property color ink: hero ? Theme.onAccent : Theme.text
            width: list.width
            height: hero ? 88 : 56
            color: hero ? Theme.pink : Theme.surface

            Rectangle {
                id: badge
                x: 14
                anchors.verticalCenter: parent.verticalCenter
                width: row.hero ? 38 : 28
                height: width
                color: row.hero ? Theme.onAccent : row.rank <= 3 ? Theme.blueSoft : Theme.surface2
                Text {
                    anchors.centerIn: parent
                    text: row.rank
                    color: row.hero ? Theme.pink : row.rank <= 3 ? Theme.blue : Theme.muted
                    font.pixelSize: row.hero ? 16 : 12
                    font.weight: Font.DemiBold
                }
            }
            Cover {
                id: cover
                anchors { left: badge.right; leftMargin: 12; verticalCenter: parent.verticalCenter }
                width: row.hero ? 64 : 40
                height: width
                color: row.hero ? Qt.rgba(0, 0, 0, 0.15) : Theme.surface2
                source: row.image
            }
            Column {
                anchors { left: cover.right; right: playsText.left; margins: 14; verticalCenter: parent.verticalCenter }
                spacing: 3
                Text {
                    width: parent.width - (subText.visible ? subText.width + 16 : 0)
                    elide: Text.ElideRight
                    textFormat: Text.PlainText
                    text: row.name
                    color: row.ink
                    font.pixelSize: row.hero ? 20 : 14
                    font.weight: row.hero ? Font.Bold : Font.DemiBold
                }
                Text {
                    visible: row.sub !== "" && row.hero
                    width: parent.width
                    elide: Text.ElideRight
                    textFormat: Text.PlainText
                    text: row.sub
                    color: row.ink
                    opacity: 0.8
                    font.pixelSize: 13
                }
                Rectangle {
                    visible: !row.hero
                    width: parent.width
                    height: 4
                    color: Theme.surface2
                    Rectangle { width: parent.width * row.plays / view.max; height: parent.height; color: Theme.pink }
                }
            }
            Text {
                id: subText
                visible: row.sub !== "" && !row.hero
                anchors { right: playsText.left; rightMargin: 18; top: parent.top; topMargin: 12 }
                width: Math.min(implicitWidth, parent.width * 0.35)
                elide: Text.ElideRight
                textFormat: Text.PlainText
                text: row.sub
                color: Theme.muted
                font.pixelSize: 13
            }
            Text {
                id: playsText
                anchors { right: parent.right; rightMargin: 18; verticalCenter: parent.verticalCenter }
                text: Api.num(row.plays)
                color: row.hero ? row.ink : Theme.muted
                font.pixelSize: row.hero ? 20 : 13
                font.weight: row.hero ? Font.Bold : Font.Normal
            }
        }
    }
}
