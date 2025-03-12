function QueueElement(content) {
    this.content = content;
    this.next = null;
}

function Queue() {
    this.head = null;
    this.tail = null;
    this.length = 0;
    this.push = function (value) {
        const newElement = new QueueElement(value);
        if (!this.head) {
            this.head = newElement;
            this.tail = newElement;
        } else {
            this.tail.next = newElement;
            this.tail = newElement;
        }
        this.length++;
    };

    this.pop = function () {
        if (!this.head) {
            return null;
        }
        const headCopy = this.head;
        this.head = this.head.next;
        this.length--;

        //fix???????
        if (this.length === 0) {
            this.tail = null;
        }

        return headCopy.content;
    };

    this.front = function () {
        return this.head ? this.head.content : undefined;
    };

    this.isEmpty = function () {
        return this.head === null;
    };

    this.remove = function (el) {
        if (this.length === 1 && el === this.front()) {
            this.head = this.tail = null;
            this.length--;
            return;
        }

        if (el === this.front()) {
            this.pop();
            return;
        }

        let head = this.head;
        let prev = null;
        while (head !== null) {
            if (head.content !== el) {
                prev = head;
                head = head.next;
                continue;
            }

            prev.next = head.next;
            this.length--;

            if (head === this.tail) {
                this.tail = prev;
            }
            return;
        }

    }

    this[Symbol.iterator] = function* () {
        let head = this.head;
        while (head !== null) {
            yield head.content;
            head = head.next;
        }
    }.bind(this);
}

Queue.prototype.toString = function () {
    let stringifiedQueue = '';
    let iterator = this.head;
    while (iterator) {
        stringifiedQueue += `${JSON.stringify(iterator.content)} `;
        iterator = iterator.next;
    }
    return stringifiedQueue;
};

Queue.prototype.inspect = Queue.prototype.toString;

module.exports = Queue;
