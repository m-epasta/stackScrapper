function testOnErrors() { /* do not test output: it test code actions/helper */
    // type error
    let obj = null;
    console.log(obj.property);

    // ref error
    console.log(undefinedVariable)

    let x = 5;
    x();
}
