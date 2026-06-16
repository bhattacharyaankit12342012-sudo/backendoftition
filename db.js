const mongoose = require("mongoose");
const storage = require("./storage");

mongoose.set("bufferCommands", false);
mongoose.set("bufferTimeoutMS", 1000);

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI; // No change here, just for context

if (mongoUri) {
    mongoose.connect(mongoUri)
        .then(() => {
            console.log("MongoDB Connected");
        })
        .catch((err) => {
            console.error("MongoDB connection error:", err.message);
        });
} else {
    console.warn("MongoDB URI not set. Using local JSON storage fallback.");
}

const isDatabaseReady = () => mongoose.connection && mongoose.connection.readyState === 1;

class LocalQuery {
    constructor(modelName, query = {}) {
        this.modelName = modelName;
        this.query = query;
        this.sortSpec = null;
    }

    sort(sortObj) {
        this.sortSpec = sortObj;
        return this;
    }

    then(resolve, reject) {
        return storage.find(this.modelName, this.query, this.sortSpec).then(resolve, reject);
    }
}

class LocalModel {
    constructor(doc = {}) {
        Object.assign(this, doc);
    }

    save() {
        return storage.save(this.constructor.modelName, this);
    }

    static find(query = {}) {
        return new LocalQuery(this.modelName, query);
    }

    static findOne(query = {}) {
        return storage.findOne(this.modelName, query);
    }

    static create(doc) {
        return storage.create(this.modelName, doc);
    }

    static findOneAndUpdate(query, update, options = {}) {
        return storage.findOneAndUpdate(this.modelName, query, update, options);
    }

    static findById(id) {
        return storage.findById(this.modelName, id);
    }

    static findByIdAndUpdate(id, update, options = {}) {
        return storage.findByIdAndUpdate(this.modelName, id, update, options);
    }

    static deleteOne(query) {
        return storage.deleteOne(this.modelName, query);
    }

    static deleteMany(query) {
        return storage.deleteMany(this.modelName, query);
    }

    static findOneAndDelete(query) {
        return storage.findOneAndDelete(this.modelName, query);
    }
}

const db = {
    Schema: mongoose.Schema,
    connection: mongoose.connection,
    isDatabaseReady,
    model(name, schema) {
        if (isDatabaseReady()) {
            return mongoose.model(name, schema);
        }

        if (!this._localModels) {
            this._localModels = {};
        }

        if (!this._localModels[name]) {
            class CustomLocalModel extends LocalModel {}
            CustomLocalModel.modelName = name;
            this._localModels[name] = CustomLocalModel;
        }

        return this._localModels[name];
    },
};

module.exports = db;