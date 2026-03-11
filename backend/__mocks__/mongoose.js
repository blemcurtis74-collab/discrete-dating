// Minimal mongoose mock – only covers what our code uses
const mongoose = {
  connect: jest.fn().mockResolvedValue({}),
  disconnect: jest.fn().mockResolvedValue({}),
  Schema: class Schema {
    constructor(def, opts) {
      this.definition = def;
      this.options = opts;
      this.methods = {};
      this.statics = {};
    }
    pre() { return this; }
    index() { return this; }
  },
  model: jest.fn((name) => name),
  connection: { collections: {} },
};

module.exports = mongoose;
