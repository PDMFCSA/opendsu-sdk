function ParallelTasks(callback) {
    let counter = 0;
    let self = this;
    let result = [];
    let alreadyReturned = false;

    this.addTask = function (func) {
        counter++;
        func(function (err, res) {
            if (err) {
                return self.onEnd(err);
            }
            result.push(res);

            counter--;
            if (counter == 0) {
                self.onEnd(undefined, result);
            }

            if (counter < 0) {
                throw new Error("Assert failure! Counter is negative!");
            }
        });
    }

    this.onEnd = function (fail, res) {
        if (!alreadyReturned) {
            alreadyReturned = true;
            callback(fail, res);
        }
    }
}

module.exports.createNewParallelTaskRunner = function (callback) {
    return new ParallelTasks(callback);
};