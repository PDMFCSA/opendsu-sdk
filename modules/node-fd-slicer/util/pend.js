function AsyncHelper() {
    this.pending = 0;
    this.max = 10;
    let listeners = [];
    let waiting = [];
    let error = null;

    this.go = function (fn) {
        if (this.pending < this.max) {
            execute(this, fn);
        } else {
            waiting.push(fn);
        }
    };

    function wait(self) {
        self.pending += 1;
        let called = false;
        return onNext;

        function onNext(err) {
            if (called) throw new Error("calling twice");
            called = true;
            error = error || err;
            self.pending -= 1;
            if (waiting.length > 0 && self.pending < self.max) {
                execute(self, waiting.shift());
            } else if (self.pending === 0) {
                const oldListeners = listeners;
                listeners = [];
                oldListeners.forEach(cbListener);
            }
        }

        function cbListener(listener) {
            listener(error);
        }
    }

    function execute(self, fn) {
        fn(wait(self));
    }
}

module.exports = AsyncHelper;