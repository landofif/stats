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
                    plays: item.plays
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

        delegate: Rectangle {
            required property int rank
            required property string name
            required property string sub
            required property int plays
            width: list.width
            height: 52
            color: Theme.card

            Text { id: rankText; x: 8; width: 30; anchors.verticalCenter: parent.verticalCenter; horizontalAlignment: Text.AlignRight; text: rank; color: Theme.muted; font.pixelSize: 13 }
            Column {
                anchors { left: rankText.right; right: playsText.left; margins: 14; verticalCenter: parent.verticalCenter }
                spacing: 2
                Text {
                    width: parent.width
                    elide: Text.ElideRight
                    textFormat: Text.PlainText
                    text: sub ? name + "  ·  " + sub : name
                    color: Theme.text
                    font.pixelSize: 14
                    font.weight: Font.DemiBold
                }
                Rectangle {
                    width: parent.width
                    height: 3
                    radius: 2
                    color: Theme.line
                    Rectangle { width: parent.width * plays / view.max; height: parent.height; radius: 2; color: Theme.accent }
                }
            }
            Text { id: playsText; anchors { right: parent.right; rightMargin: 14; verticalCenter: parent.verticalCenter } text: Api.num(plays); color: Theme.muted; font.pixelSize: 13 }
            Rectangle { width: parent.width; height: 1; color: Theme.line; anchors.bottom: parent.bottom }
        }
    }
}
