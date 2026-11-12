import QtQuick
import QtQuick.Controls.Basic

// Now playing and the latest scrobbles, live from Last.fm through the Worker.
Item {
    id: view
    property var nowPlaying: null
    property string message: "Loading…"

    function reload() {
        Api.load("/recent?limit=100", function (data, error) {
            if (!data) {
                view.message = "Could not load: " + error
                return
            }
            view.nowPlaying = data.nowPlaying
            view.message = data.tracks.length || data.nowPlaying ? "" : "No scrobbles yet."
            const today = new Date().toDateString()
            const yesterday = new Date(Date.now() - 864e5).toDateString()
            tracks.clear()
            for (const t of data.tracks) {
                const date = new Date(t.ts * 1000)
                const day = date.toDateString()
                tracks.append({
                    track: t.track,
                    sub: t.album ? t.artist + " · " + t.album : t.artist,
                    image: t.image,
                    day: day === today ? "Today" : day === yesterday ? "Yesterday" : Qt.formatDate(date, "ddd d MMM"),
                    time: Qt.formatTime(date, "HH:mm")
                })
            }
        }, true)
    }
    onVisibleChanged: if (visible) reload()
    Component.onCompleted: reload()
    Timer { interval: 30000; repeat: true; running: view.visible; onTriggered: view.reload() }

    ListModel { id: tracks }

    component Cover: Rectangle {
        property string source
        radius: 6
        color: Theme.line
        Image {
            anchors.fill: parent
            source: parent.source
            sourceSize: Qt.size(128, 128)
            fillMode: Image.PreserveAspectCrop
            asynchronous: true
        }
    }

    Text {
        anchors.centerIn: parent
        visible: view.message !== "" && tracks.count === 0
        text: view.message
        color: Theme.muted
    }

    ListView {
        id: list
        anchors.fill: parent
        clip: true
        model: tracks
        boundsBehavior: Flickable.StopAtBounds
        ScrollBar.vertical: ScrollBar {}

        header: Item {
            width: list.width
            height: view.nowPlaying ? 96 : 0
            visible: view.nowPlaying !== null
            Rectangle {
                width: parent.width
                height: 84
                radius: 14
                color: Theme.card
                Cover { id: cover; x: 10; y: 10; width: 64; height: 64; radius: 8; source: view.nowPlaying ? view.nowPlaying.image : "" }
                Column {
                    anchors { left: cover.right; right: parent.right; margins: 12; verticalCenter: parent.verticalCenter }
                    Text { text: "Now playing"; color: Theme.accent; font.pixelSize: 12; font.weight: Font.DemiBold }
                    Text { width: parent.width; elide: Text.ElideRight; textFormat: Text.PlainText; text: view.nowPlaying ? view.nowPlaying.track : ""; color: Theme.text; font.pixelSize: 15; font.weight: Font.DemiBold }
                    Text { width: parent.width; elide: Text.ElideRight; textFormat: Text.PlainText; text: view.nowPlaying ? view.nowPlaying.artist : ""; color: Theme.muted; font.pixelSize: 13 }
                }
            }
        }

        section.property: "day"
        section.delegate: Text {
            required property string section
            text: section.toUpperCase()
            color: Theme.muted
            font.pixelSize: 12
            font.weight: Font.DemiBold
            font.letterSpacing: 0.5
            topPadding: 12
            bottomPadding: 6
            leftPadding: 4
        }

        delegate: Rectangle {
            required property string track
            required property string sub
            required property string image
            required property string time
            width: list.width
            height: 56
            color: Theme.card
            Cover { id: art; x: 10; anchors.verticalCenter: parent.verticalCenter; width: 40; height: 40; source: parent.image }
            Column {
                anchors { left: art.right; right: clock.left; margins: 12; verticalCenter: parent.verticalCenter }
                Text { width: parent.width; elide: Text.ElideRight; textFormat: Text.PlainText; text: track; color: Theme.text; font.pixelSize: 14; font.weight: Font.DemiBold }
                Text { width: parent.width; elide: Text.ElideRight; textFormat: Text.PlainText; text: sub; color: Theme.muted; font.pixelSize: 13 }
            }
            Text { id: clock; anchors { right: parent.right; rightMargin: 14; verticalCenter: parent.verticalCenter } text: time; color: Theme.muted; font.pixelSize: 13 }
            Rectangle { width: parent.width; height: 1; color: Theme.line; anchors.bottom: parent.bottom }
        }
    }
}
