// Generated by CoffeeScript 1.3.1
var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

define('hoodie/remote', ['hoodie/errors'], function(ERROR) {
  var Remote;
  return Remote = (function() {

    Remote.name = 'Remote';

    function Remote(hoodie) {
      this.hoodie = hoodie;
      this._handle_push_changes = __bind(this._handle_push_changes, this);

      this._handle_pull_changes = __bind(this._handle_pull_changes, this);

      this._changes_error = __bind(this._changes_error, this);

      this._changes_success = __bind(this._changes_success, this);

      this._restart_changes_request = __bind(this._restart_changes_request, this);

      this.push_changes = __bind(this.push_changes, this);

      this.pull_changes = __bind(this.pull_changes, this);

      this.disconnect = __bind(this.disconnect, this);

      this.connect = __bind(this.connect, this);

      this.hoodie.on('account:signed_in', this.connect);
      this.hoodie.on('account:signed_out', this.disconnect);
      this.hoodie.account.authenticate().then(this.connect);
    }

    Remote.prototype.connect = function() {
      if (this._connected) {
        return;
      }
      this.hoodie.on('store:dirty:idle', this.push_changes);
      this.pull_changes();
      return this.push_changes();
    };

    Remote.prototype.disconnect = function() {
      var _ref;
      this._connected = false;
      if ((_ref = this._changes_request) != null) {
        _ref.abort();
      }
      this.reset_seq();
      return this.hoodie.unbind('store:dirty:idle', this.push_changes);
    };

    Remote.prototype.pull_changes = function() {
      this._connected = true;
      this._changes_request = this.hoodie.request('GET', this._changes_path(), {
        success: this._changes_success,
        error: this._changes_error
      });
      window.clearTimeout(this._changes_request_timeout);
      return this._changes_request_timeout = window.setTimeout(this._restart_changes_request, 25000);
    };

    Remote.prototype.push_changes = function() {
      var doc, docs;
      docs = this.hoodie.store.changed_docs();
      if (docs.length === 0) {
        return this._promise().resolve([]);
      }
      docs = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = docs.length; _i < _len; _i++) {
          doc = docs[_i];
          _results.push(this._parse_for_remote(doc));
        }
        return _results;
      }).call(this);
      return this.hoodie.request('POST', "/" + (encodeURIComponent(this.hoodie.account.db())) + "/_bulk_docs", {
        dataType: 'json',
        processData: false,
        contentType: 'application/json',
        data: JSON.stringify({
          docs: docs
        }),
        success: this._handle_push_changes
      });
    };

    Remote.prototype.get_seq = function() {
      return this._seq || (this._seq = this.hoodie.config.get('_remote.seq') || 0);
    };

    Remote.prototype.set_seq = function(seq) {
      return this._seq = this.hoodie.config.set('_remote.seq', seq);
    };

    Remote.prototype.reset_seq = function() {
      this.hoodie.config.remove('_remote.seq');
      return delete this._seq;
    };

    Remote.prototype.on = function(event, cb) {
      return this.hoodie.on("remote:" + event, cb);
    };

    Remote.prototype._changes_path = function() {
      var since;
      since = this.get_seq();
      return "/" + (encodeURIComponent(this.hoodie.account.db())) + "/_changes?include_docs=true&heartbeat=10000&feed=longpoll&since=" + since;
    };

    Remote.prototype._restart_changes_request = function() {
      var _ref;
      return (_ref = this._changes_request) != null ? _ref.abort() : void 0;
    };

    Remote.prototype._changes_success = function(response) {
      if (!this._connected) {
        return;
      }
      this.set_seq(response.last_seq);
      this._handle_pull_changes(response.results);
      return this.pull_changes();
    };

    Remote.prototype._changes_error = function(xhr, error, resp) {
      if (!this._connected) {
        return;
      }
      switch (xhr.status) {
        case 403:
          this.hoodie.trigger('remote:error:unauthenticated');
          return this.disconnect();
        case 404:
          return window.setTimeout(this.pull_changes, 3000);
        case 500:
          this.hoodie.trigger('remote:error:server');
          return window.setTimeout(this.pull_changes, 3000);
        default:
          if (xhr.statusText === 'abort') {
            return this.pull_changes();
          } else {
            return window.setTimeout(this.pull_changes, 3000);
          }
      }
    };

    Remote.prototype._valid_special_attributes = {
      '_id': 1,
      '_rev': 1,
      '_deleted': 1
    };

    Remote.prototype._parse_for_remote = function(obj) {
      var attr, attributes;
      attributes = $.extend({}, obj);
      for (attr in attributes) {
        if (this._valid_special_attributes[attr]) {
          continue;
        }
        if (!/^_/.test(attr)) {
          continue;
        }
        delete attributes[attr];
      }
      attributes._id = "" + attributes.type + "/" + attributes.id;
      delete attributes.id;
      return attributes;
    };

    Remote.prototype._parse_from_remote = function(obj) {
      var id, _ref;
      id = obj._id || obj.id;
      delete obj._id;
      if (id === void 0) {
        console.log('obj');
        console.log(JSON.stringify(obj));
      }
      _ref = id.split(/\//), obj.type = _ref[0], obj.id = _ref[1];
      if (obj.created_at) {
        obj.created_at = new Date(Date.parse(obj.created_at));
      }
      if (obj.updated_at) {
        obj.updated_at = new Date(Date.parse(obj.updated_at));
      }
      return obj;
    };

    Remote.prototype._handle_pull_changes = function(changes) {
      var doc, _doc, _i, _len, _results,
        _this = this;
      _results = [];
      for (_i = 0, _len = changes.length; _i < _len; _i++) {
        doc = changes[_i].doc;
        _doc = this._parse_from_remote(doc);
        if (_doc._deleted) {
          _results.push(this.hoodie.store.destroy(_doc.type, _doc.id, {
            remote: true
          }).then(function(object) {
            _this.hoodie.trigger('remote:destroyed', _doc.type, _doc.id, object);
            _this.hoodie.trigger("remote:destroyed:" + _doc.type, _doc.id, object);
            _this.hoodie.trigger("remote:destroyed:" + _doc.type + ":" + _doc.id, object);
            _this.hoodie.trigger('remote:changed', 'destroyed', _doc.type, _doc.id, object);
            _this.hoodie.trigger("remote:changed:" + _doc.type, 'destroyed', _doc.id, object);
            return _this.hoodie.trigger("remote:changed:" + _doc.type + ":" + _doc.id, 'destroyed', object);
          }));
        } else {
          _results.push(this.hoodie.store.save(_doc.type, _doc.id, _doc, {
            remote: true
          }).then(function(object, object_was_created) {
            if (object_was_created) {
              _this.hoodie.trigger('remote:created', _doc.type, _doc.id, object);
              _this.hoodie.trigger("remote:created:" + _doc.type, _doc.id, object);
              _this.hoodie.trigger("remote:created:" + _doc.type + ":" + _doc.id, object);
              _this.hoodie.trigger('remote:changed', 'created', _doc.type, _doc.id, object);
              _this.hoodie.trigger("remote:changed:" + _doc.type, 'created', _doc.id, object);
              return _this.hoodie.trigger("remote:changed:" + _doc.type + ":" + _doc.id, 'created', object);
            } else {
              _this.hoodie.trigger('remote:updated', _doc.type, _doc.id, object);
              _this.hoodie.trigger("remote:updated:" + _doc.type, _doc.id, object);
              _this.hoodie.trigger("remote:updated:" + _doc.type + ":" + _doc.id, object);
              _this.hoodie.trigger('remote:changed', 'updated', _doc.type, _doc.id, object);
              _this.hoodie.trigger("remote:changed:" + _doc.type, 'updated', _doc.id, object);
              return _this.hoodie.trigger("remote:changed:" + _doc.type + ":" + _doc.id, 'updated', object);
            }
          }));
        }
      }
      return _results;
    };

    Remote.prototype._handle_push_changes = function(doc_responses) {
      var response, _i, _len, _results;
      _results = [];
      for (_i = 0, _len = doc_responses.length; _i < _len; _i++) {
        response = doc_responses[_i];
        if (response.error === 'conflict') {
          _results.push(this.hoodie.trigger('remote:error:conflict', response.id));
        }
      }
      return _results;
    };

    Remote.prototype._promise = $.Deferred;

    return Remote;

  })();
});
