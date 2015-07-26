/* global Y */
/* eslint-env browser,jasmine */

/*
  This is just a compilation of functions that help to test this library!
***/

function wait(t = 0) {//eslint-disable-line
  var def = Promise.defer()
  setTimeout(function () {
    def.resolve()
  }, t)
  return def.promise
}

// returns a random element of o
// works on Object, and Array
function getRandom (o) {
  if (o instanceof Array) {
    return o[Math.floor(Math.random() * o.length)]
  } else if (o.constructor === Object) {
    var ks = []
    for (var key in o) {
      ks.push(key)
    }
    return o[getRandom(ks)]
  }
}
function getRandomNumber(n) {//eslint-disable-line
  if (n == null) {
    n = 9999
  }
  return Math.floor(Math.random() * n)
}

async function applyRandomTransactions (users, objects, transactions, numberOfTransactions) {//eslint-disable-line
  function randomTransaction (root) {
    var f = getRandom(transactions)
    f(root)
  }
  function applyTransactions () {
    for (var i = 0; i < numberOfTransactions / 2 + 1; i++) {
      var r = Math.random()
      if (r >= 0.9) {
        // 10% chance to flush
        users[0].connector.flushOne()
      } else {
        randomTransaction(getRandom(objects))
      }
      wait()
    }
  }
  applyTransactions()
  await users[0].connector.flushAll()
  users[0].disconnect()
  await wait()
  applyTransactions()
  await users[0].connector.flushAll()
  users[0].reconnect()
  await wait()
  await users[0].connector.flushAll()
}

async function compareAllUsers(users){//eslint-disable-line
  var s1, s2, ds1, ds2, allDels1, allDels2
  var db1 = []
  function * t1 () {
    s1 = yield* this.getStateSet()
    ds1 = yield* this.getDeleteSet()
    allDels1 = []
    yield* this.ds.iterate(null, null, function (d) {
      allDels1.push(d)
    })
  }
  function * t2 () {
    s2 = yield* this.getStateSet()
    ds2 = yield* this.getDeleteSet()
    allDels2 = []
    yield* this.ds.iterate(null, null, function (d) {
      allDels2.push(d)
    })
  }
  await users[0].connector.flushAll()
  for (var uid = 0; uid < users.length; uid++) {
    var u = users[uid]
    // compare deleted ops against deleteStore
    u.db.os.iterate(null, null, function (o) {
      if (o.deleted === true) {
        expect(u.db.ds.isDeleted(o.id)).toBeTruthy()
      }
    })
    // compare deleteStore against deleted ops
    u.db.requestTransaction(function * () {
      var ds = []
      u.db.ds.iterate(null, null, function (d) {
        ds.push(d)
      })
      for (var j in ds) {
        var d = ds[j]
        for (var i = 0; i < d.len; i++) {
          var o = yield* this.getOperation([d.id[0], d.id[1] + i])
          if (o != null) {
            expect(o.deleted).toBeTruthy()
          }
        }
      }
    })
    // compare allDels tree
    await wait()
    if (s1 == null) {
      u.db.requestTransaction(t1)
      await wait()
      u.db.os.iterate(null, null, function(o){//eslint-disable-line
        db1.push(o)
      })
    } else {
      u.db.requestTransaction(t2)
      await wait()
      expect(s1).toEqual(s2)
      expect(allDels1).toEqual(allDels2) // inner structure
      expect(ds1).toEqual(ds2) // exported structure
      var count = 0
      u.db.os.iterate(null, null, function(o){//eslint-disable-line
        expect(db1[count++]).toEqual(o)
      })
    }
  }
}

async function createUsers(self, numberOfUsers) {//eslint-disable-line
  if (globalRoom.users[0] != null) {//eslint-disable-line
    await globalRoom.users[0].flushAll()//eslint-disable-line
  }
  // destroy old users
  for (var u in globalRoom.users) {//eslint-disable-line
    globalRoom.users[u].y.destroy()//eslint-disable-line
  }
  self.users = []

  var promises = []
  for (var i = 0; i < numberOfUsers; i++) {
    promises.push(Y({
      db: {
        name: 'Memory',
        gcTimeout: -1
      },
      connector: {
        name: 'Test',
        debug: false
      }
    }))
  }
  self.users = await Promise.all(promises)
}